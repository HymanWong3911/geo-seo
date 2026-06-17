import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { distributeToTarget } from "@/lib/distribution";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  targetIds: z.array(z.string()).min(1).max(20),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const draft = await prisma.contentDraft.findUnique({ where: { id: params.id } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    if (draft.status !== "APPROVED" && draft.status !== "PUBLISHED") {
      throw Errors.badRequest(`草稿状态 ${draft.status} 不能分发，需先审核通过`);
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const results = [];
    for (const targetId of parsed.data.targetIds) {
      const r = await distributeToTarget({ draftId: draft.id, targetId });
      results.push({ targetId, ...r });
    }

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { targetCount: parsed.data.targetIds.length, successCount: results.filter((r) => r.success).length },
    });

    return success({ results });
  } catch (err) {
    return handleError(err);
  }
}
