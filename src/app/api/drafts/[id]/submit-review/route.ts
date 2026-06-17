// 提交草稿审核。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const draft = await prisma.contentDraft.findUnique({ where: { id: params.id } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    if (draft.status !== "DRAFT" && draft.status !== "REJECTED") {
      throw Errors.conflict(`当前状态 ${draft.status} 不能提交审核`);
    }

    if (!draft.content.trim()) {
      throw Errors.badRequest("空内容不能提交");
    }

    const updated = await prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
      },
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "submit-review" },
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}
