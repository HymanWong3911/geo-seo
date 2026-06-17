// 搜索引擎提交。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { submitSitemap, pingUrl } from "@/lib/search/submit";
import { Errors, handleError, success } from "@/lib/api/response";

const sitemapSchema = z.object({
  type: z.literal("sitemap"),
  engine: z.enum(["google", "baidu", "both"]).default("both"),
});

const pingSchema = z.object({
  type: z.literal("ping"),
  url: z.string().url(),
  engine: z.enum(["google", "baidu", "indexnow", "all"]).default("all"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsedSitemap = sitemapSchema.safeParse(body);
    const parsedPing = pingSchema.safeParse(body);

    let results: Array<{ success: boolean; message: string; response?: unknown }>;

    if (parsedSitemap.success) {
      const project = await prisma.project.findUnique({ where: { id: params.projectId } });
      if (!project) throw Errors.notFound("项目");
      if (!project.sitemapUrl) {
        throw Errors.badRequest("项目没有配置 sitemapUrl，请先在项目设置中添加");
      }
      results = await submitSitemap(project.sitemapUrl, parsedSitemap.data.engine);
      await audit("REPORT_EXPORT", {
        userId: session.user.id,
        targetType: "Project",
        targetId: params.projectId,
        metadata: { action: "sitemap-submit", sitemapUrl: project.sitemapUrl, results: results.length },
      });
    } else if (parsedPing.success) {
      results = await pingUrl(parsedPing.data.url, parsedPing.data.engine);
      await audit("REPORT_EXPORT", {
        userId: session.user.id,
        targetType: "Project",
        targetId: params.projectId,
        metadata: { action: "url-ping", url: parsedPing.data.url, results: results.length },
      });
    } else {
      throw Errors.badRequest("type 必须是 sitemap 或 ping");
    }

    return success({ results });
  } catch (err) {
    return handleError(err);
  }
}
