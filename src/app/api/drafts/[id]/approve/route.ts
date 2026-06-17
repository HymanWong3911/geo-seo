// 审核通过。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectOwner } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  comments: z.string().optional(),
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

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.$transaction([
      prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "APPROVED",
          reviewerId: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: parsed.data.comments ?? null,
        },
      }),
      prisma.contentReview.create({
        data: {
          draftId: draft.id,
          reviewerId: session.user.id,
          decision: "approve",
          comments: parsed.data.comments ?? null,
        },
      }),
    ]);

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "approve" },
    });

    // AUTO 模式：APPROVED 时自动 enqueue 所有 publishMode=AUTO 且 autoPublishOn=APPROVED 的目标
    try {
      const { enqueueAutoDistribution } = await import("@/lib/queue/distribution");
      const autoTargets = await prisma.distributionTarget.findMany({
        where: {
          projectId: draft.projectId,
          active: true,
          publishMode: "AUTO",
          autoPublishOn: "APPROVED",
        },
        select: { id: true },
      });
      for (const t of autoTargets) {
        await enqueueAutoDistribution(draft.id, t.id);
      }
      if (autoTargets.length > 0) {
        console.log(`[approve] enqueued ${autoTargets.length} AUTO distribution jobs for draft ${draft.id}`);
      }
    } catch (err) {
      console.error("[approve] AUTO enqueue failed", err);
    }

    return success(updated[0]);
  } catch (err) {
    return handleError(err);
  }
}
