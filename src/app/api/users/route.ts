// 用户列表 + 创建。
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { generateRandomPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/logger";
import { createUserSchema } from "@/lib/api/validators/user";
import { Errors, handleError, paginated, created, success } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);
    const search = url.searchParams.get("search") ?? "";

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(users, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      throw Errors.conflict("邮箱已被注册");
    }

    const tempPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash,
        mustChangePassword: true,
        lastPasswordChangeAt: new Date(),
      },
    });

    await audit("PROJECT_CREATE", {
      // 复用：没有 USER_CREATE enum，暂时用占位
      // 实际 v1.2 应新增 USER_CREATE
      userId: session.user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return created({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tempPassword, // 仅返回一次
    });
  } catch (err) {
    return handleError(err);
  }
}
