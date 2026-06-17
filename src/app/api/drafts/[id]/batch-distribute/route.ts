import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { distributeToTarget } from "@/lib/distribution";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  targetIds: z.array(z.string()).min(1).max(50),
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  excerpt: z.string().max(500).optional(),
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

    let body: unknown = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      throw Errors.badRequest("请求体 JSON 解析失败");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const { targetIds, title, content, excerpt } = parsed.data;

    const targets = await prisma.distributionTarget.findMany({
      where: { id: { in: targetIds }, projectId: draft.projectId },
    });
    if (targets.length !== targetIds.length) {
      throw Errors.badRequest("部分目标不属于该项目");
    }

    const results = [];
    const override = title || content || excerpt ? { title, content, excerpt } : undefined;

    for (const targetId of targetIds) {
      try {
        const r = await distributeToTarget({ draftId: draft.id, targetId, override });
        const t = targets.find((x) => x.id === targetId)!;
        results.push({ targetId, targetName: t.name, platform: t.platform, ...r });
      } catch (err) {
        const t = targets.find((x) => x.id === targetId)!;
        results.push({ targetId, targetName: t.name, platform: t.platform, success: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { targetCount: targetIds.length, successCount },
    });

    return success({ draftId: draft.id, total: targetIds.length, successCount, failedCount: targetIds.length - successCount, results });
  } catch (err) {
    return handleError(err);
  }
}
