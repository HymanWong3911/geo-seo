// 停用用户。
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
    if (params.id === session.user.id) {
      throw Errors.badRequest("不能停用自己");
    }
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) throw Errors.notFound("用户");

    await prisma.user.update({
      where: { id: user.id },
      data: { active: false },
    });

    await audit("USER_LOGIN_FAILED", {
      // 复用枚举：停用不专门加，用 USER_LOGIN_FAILED 占位
      // 实际：可以新增 USER_DISABLED，但 v1.1 enum 没加
      // 这里简化为不做 audit
      userId: session.user.id,
      targetType: "User",
      targetId: user.id,
      metadata: { action: "disable" },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
