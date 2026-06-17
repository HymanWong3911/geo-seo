// 单个评论删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) throw Errors.notFound("评论");

    if (comment.authorId !== session.user.id && session.user.role !== "ADMIN") {
      throw Errors.forbidden("只能删除自己的评论");
    }

    await prisma.comment.delete({ where: { id: comment.id } });

    await audit("DATA_DELETE", {
      userId: session.user.id,
      targetType: "Comment",
      targetId: comment.id,
      metadata: { targetType: comment.targetType, targetId: comment.targetId },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
