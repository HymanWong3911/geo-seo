// 邮件重置密码：提交新密码（带 token）。
// 详细说明见 dev doc v1.2 15.4 节。
import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validatePassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/logger";
import { resetPasswordByTokenSchema } from "@/lib/api/validators/user";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordByTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(parsed.data.token)
      .digest("hex");

    const token = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw Errors.tokenExpired();
    }

    const v = validatePassword(parsed.data.newPassword);
    if (!v.ok) {
      throw Errors.badRequest("新密码不符合策略", { errors: v.errors });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          lastPasswordChangeAt: new Date(),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await audit("USER_PASSWORD_RESET", {
      userId: token.userId,
      targetType: "User",
      targetId: token.userId,
      metadata: { method: "email" },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
