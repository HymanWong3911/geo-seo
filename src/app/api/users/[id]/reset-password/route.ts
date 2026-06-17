// ADMIN 重置用户密码。
// 详细说明见 dev doc v1.2 15.4 节。
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { generateRandomPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) throw Errors.notFound("用户");

    const newPassword = generateRandomPassword();
    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: true,
        lastPasswordChangeAt: new Date(),
      },
    });

    await audit("USER_PASSWORD_RESET", {
      userId: session.user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { method: "admin" },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    // 临时密码仅在响应中返回一次
    return success({ tempPassword: newPassword });
  } catch (err) {
    return handleError(err);
  }
}
