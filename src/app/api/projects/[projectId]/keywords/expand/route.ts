// 关键词扩展。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { expandKeywords } from "@/lib/keyword/expander";
import { SearchIntent } from "@prisma/client";
import { Errors, handleError, success, created } from "@/lib/api/response";

const schema = z.object({
  seedKeyword: z.string().min(1).max(200),
  maxSuggestions: z.number().int().min(1).max(50).default(20),
  saveToDb: z.boolean().default(true),
  language: z.string().default("zh-CN"),
  region: z.string().default("CN"),
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

    const suggestions = await expandKeywords({
      seedKeyword: parsed.data.seedKeyword,
      brandContext: project.brands[0]?.description ?? undefined,
      maxSuggestions: parsed.data.maxSuggestions,
      language: parsed.data.language,
      region: parsed.data.region,
    });

    if (!parsed.data.saveToDb) {
      return success({ suggestions });
    }

    // 存到 KeywordExpansion 表（status = SUGGESTED，用户可手动 accept）
    const result = await prisma.keywordExpansion.createMany({
      data: suggestions.map((s) => ({
        projectId: params.projectId,
        seedKeywordText: parsed.data.seedKeyword,
        expandedText: s.text,
        searchVolume: s.searchVolume,
        difficulty: s.difficulty,
        intent: s.intent as SearchIntent,
        status: "SUGGESTED",
      })),
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "Project",
      targetId: params.projectId,
      metadata: { action: "keyword-expand", count: result.count, seed: parsed.data.seedKeyword },
    });

    return created({ count: result.count, suggestions });
  } catch (err) {
    return handleError(err);
  }
}
