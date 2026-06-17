// 单个用户读取 / 更新。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateUserSchema } from "@/lib/api/validators/user";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    // MEMBER 只能看自己
    if (session.user.role !== "ADMIN" && session.user.id !== params.id) {
      throw Errors.forbidden("只能查看自己的信息");
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
        lastLoginAt: true,
        lastPasswordChangeAt: true,
        createdAt: true,
      },
    });
    if (!user) throw Errors.notFound("用户");

    return success(user);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 非 ADMIN 只能改自己，且不能改 role / active
    if (session.user.role !== "ADMIN") {
      if (session.user.id !== params.id) {
        throw Errors.forbidden("只能修改自己的信息");
      }
      if (parsed.data.role || parsed.data.active !== undefined) {
        throw Errors.forbidden("无权修改角色或状态");
      }
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) throw Errors.notFound("用户");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
      },
    });

    await audit("PROJECT_UPDATE", {
      userId: session.user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { changes: Object.keys(parsed.data) },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}
