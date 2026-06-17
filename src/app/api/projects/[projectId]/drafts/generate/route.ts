// AI 内容生成。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { generateContent } from "@/lib/content/generator";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  topic: z.string().min(1).max(200),
  targetKeywords: z.array(z.string().min(1)).min(1).max(10),
  outline: z.array(z.string()).max(20).optional(),
  length: z.number().int().min(200).max(10000).default(1500),
  tone: z.enum(["professional", "casual", "technical", "marketing"]).default("professional"),
  language: z.string().default("zh-CN"),
  saveAsDraft: z.boolean().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: { brands: { where: { isPrimary: true } } },
    });
    if (!project) throw Errors.notFound("项目");

    const primaryBrand = project.brands[0];
    if (!primaryBrand) {
      throw Errors.badRequest("项目还没有主品牌，请先到「品牌与竞品」添加");
    }

    const generated = await generateContent({
      topic: parsed.data.topic,
      targetKeywords: parsed.data.targetKeywords,
      outline: parsed.data.outline,
      length: parsed.data.length,
      tone: parsed.data.tone,
      language: parsed.data.language,
      brandName: primaryBrand.name,
      brandDescription: primaryBrand.description ?? undefined,
    });

    if (!parsed.data.saveAsDraft) {
      return success(generated);
    }

    // 存为草稿
    const draft = await prisma.contentDraft.create({
      data: {
        projectId: params.projectId,
        title: generated.title,
        content: generated.content,
        contentFormat: "markdown",
        excerpt: generated.excerpt,
        metaTitle: generated.metaTitle,
        metaDescription: generated.metaDescription,
        sourceType: "AI_GENERATED",
        sourcePrompt: `topic: ${parsed.data.topic}\nkeywords: ${parsed.data.targetKeywords.join(", ")}`,
        targetKeywords: parsed.data.targetKeywords,
        authorId: session.user.id,
      },
    });

    await prisma.contentRevision.create({
      data: {
        draftId: draft.id,
        version: 1,
        title: draft.title,
        content: draft.content,
        contentFormat: draft.contentFormat,
        excerpt: draft.excerpt,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        changeNote: "AI 生成初始版本",
        createdById: session.user.id,
      },
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "ai-generate", topic: parsed.data.topic, projectId: params.projectId },
    });

    return success({ draftId: draft.id, generated });
  } catch (err) {
    return handleError(err);
  }
}
