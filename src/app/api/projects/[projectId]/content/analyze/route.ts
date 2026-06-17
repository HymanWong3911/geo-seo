// 内容分析。
// POST /api/projects/:projectId/content/analyze
// 详细说明见 dev doc v1.2 12 节。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { analyzeContent } from "@/lib/content/analyzer";
import { Errors, handleError, success } from "@/lib/api/response";

const analyzeSchema = z
  .object({
    url: z.string().url().optional(),
    content: z.string().min(50).optional(),
    contentFormat: z.enum(["html", "text"]).default("text"),
    targetKeywords: z.array(z.string().min(1)).min(1).max(20),
    geoQuestionIds: z.array(z.string()).max(50).optional(),
  })
  .refine((d) => d.url || d.content, {
    message: "必须提供 url 或 content 之一",
  });

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = analyzeSchema.safeParse(body);
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

    const result = await analyzeContent({
      ...parsed.data,
      projectId: params.projectId,
      brandName: primaryBrand.name,
      brandDescription: primaryBrand.description ?? undefined,
    });

    await audit("CONTENT_ANALYSIS_TRIGGER", {
      userId: session.user.id,
      targetType: "Project",
      targetId: params.projectId,
      metadata: {
        url: parsed.data.url,
        targetKeywords: parsed.data.targetKeywords,
        seoTasks: result.taskSuggestions.filter((t) => t.source === "SEO").length,
        geoTasks: result.taskSuggestions.filter((t) => t.source === "GEO").length,
      },
    });

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}
