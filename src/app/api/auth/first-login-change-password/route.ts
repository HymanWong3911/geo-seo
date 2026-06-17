// 首次登录改密。
// 详细说明见 dev doc v1.2 15.4 节。
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/logger";
import { firstLoginChangePasswordSchema } from "@/lib/api/validators/user";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) throw Errors.unauthorized();

    const body = await req.json();
    const parsed = firstLoginChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    if (!session.user.mustChangePassword) {
      throw Errors.badRequest("当前不需要改密");
    }

    const v = validatePassword(parsed.data.newPassword);
    if (!v.ok) {
      throw Errors.badRequest("新密码不符合策略", { errors: v.errors });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    await audit("USER_PASSWORD_CHANGED", {
      userId: session.user.id,
      targetType: "User",
      targetId: session.user.id,
      metadata: { firstLogin: true },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
