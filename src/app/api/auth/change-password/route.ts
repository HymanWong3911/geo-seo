// 当前用户改密（已登录状态）。
// 详细说明见 dev doc v1.2 15.4 节。
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { validatePassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/logger";
import { changePasswordSchema } from "@/lib/api/validators/user";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) throw Errors.unauthorized();

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user || !user.passwordHash) {
      throw Errors.invalidCredentials();
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) throw Errors.invalidCredentials();

    const v = validatePassword(parsed.data.newPassword);
    if (!v.ok) {
      throw Errors.badRequest("新密码不符合策略", { errors: v.errors });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    await audit("USER_PASSWORD_CHANGED", {
      userId: user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { firstLogin: false },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
