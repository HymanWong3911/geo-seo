// 重新启用用户。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
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

    await prisma.user.update({
      where: { id: user.id },
      data: { active: true },
    });

    await audit("USER_LOGIN", {
      userId: session.user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { action: "enable" },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
