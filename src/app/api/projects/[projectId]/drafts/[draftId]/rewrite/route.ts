// AI 内容改写。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { rewriteContent } from "@/lib/content/rewriter";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  content: z.string().min(50),
  findings: z.array(z.object({
    code: z.string(),
    severity: z.enum(["high", "medium", "low"]),
    title: z.string(),
    description: z.string(),
    recommendation: z.string(),
  })),
  targetKeywords: z.array(z.string()).default([]),
  saveAsNewVersion: z.boolean().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; draftId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const draft = await prisma.contentDraft.findUnique({ where: { id: params.draftId } });
    if (!draft) throw Errors.notFound("草稿");
    if (draft.projectId !== params.projectId) {
      throw Errors.forbidden("草稿不属于该项目");
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: { brands: { where: { isPrimary: true } } },
    });

    const result = await rewriteContent({
      originalContent: parsed.data.content,
      findings: parsed.data.findings,
      targetKeywords: parsed.data.targetKeywords,
      brandName: project?.brands[0]?.name,
    });

    if (!parsed.data.saveAsNewVersion) {
      return success(result);
    }

    // 创建新版本
    const lastVersion = await prisma.contentRevision.findFirst({
      where: { draftId: draft.id },
      orderBy: { version: "desc" },
    });
    const newVersion = (lastVersion?.version ?? 0) + 1;

    await prisma.contentRevision.create({
      data: {
        draftId: draft.id,
        version: newVersion,
        title: draft.title,
        content: result.rewritten,
        contentFormat: draft.contentFormat,
        excerpt: draft.excerpt,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        changeNote: `AI 改写：应用 ${result.appliedFindingCodes.length} 项`,
        createdById: session.user.id,
      },
    });

    // 更新草稿当前内容
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        content: result.rewritten,
      },
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "ai-rewrite", appliedCodes: result.appliedFindingCodes },
    });

    return success({
      newVersion,
      result,
    });
  } catch (err) {
    return handleError(err);
  }
}
