// 审核驳回。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectOwner } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  comments: z.string().min(1, "请填写驳回原因"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const draft = await prisma.contentDraft.findUnique({ where: { id: params.id } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectOwner(session.user.id, session.user.role, draft.projectId);

    if (draft.status !== "PENDING_REVIEW") {
      throw Errors.conflict(`当前状态 ${draft.status} 不能审核`);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.$transaction([
      prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "REJECTED",
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: parsed.data.comments,
        },
      }),
      prisma.contentReview.create({
        data: {
          draftId: draft.id,
          reviewerId: session.user.id,
          decision: "reject",
          comments: parsed.data.comments,
        },
      }),
    ]);

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "reject" },
    });

    return success(updated[0]);
  } catch (err) {
    return handleError(err);
  }
}
