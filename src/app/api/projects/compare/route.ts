// 多项目对比：一次性返回多个项目的核心指标。
// GET /api/projects/compare?ids=id1,id2,id3
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

    if (ids.length === 0) {
      throw Errors.badRequest("ids 不能为空");
    }
    if (ids.length > 10) {
      throw Errors.badRequest("最多对比 10 个项目");
    }

    // 验证权限
    for (const id of ids) {
      await requireProjectEditor(session.user.id, session.user.role, id);
    }

    // 并行计算每个项目的指标
    const results = await Promise.all(
      ids.map(async (id) => {
        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
          return null;
        }
        const [
          keywordCount,
          questionCount,
          brandCount,
          competitorCount,
          pageCount,
          taskOpenCount,
          geoRunCount,
          successRunCount,
          pageAuditAgg,
          geoMetrics,
        ] = await Promise.all([
          prisma.keyword.count({ where: { projectId: id } }),
          prisma.geoQuestion.count({ where: { projectId: id, active: true } }),
          prisma.brand.count({ where: { projectId: id } }),
          prisma.competitor.count({ where: { projectId: id } }),
          prisma.page.count({ where: { projectId: id } }),
          prisma.optimizationTask.count({
            where: { projectId: id, status: { in: ["TODO", "DOING"] } },
          }),
          prisma.geoRun.count({ where: { projectId: id } }),
          prisma.geoRun.count({
            where: { projectId: id, status: { in: ["SUCCESS", "PARTIAL_FAILURE"] } },
          }),
          prisma.pageAudit.aggregate({
            where: { page: { projectId: id } },
            _avg: { score: true },
          }),
          calculateProjectGeoMetrics(id).catch(() => null),
        ]);

        return {
          project: {
            id: project.id,
            name: project.name,
            domain: project.domain,
            primaryBrand: project.primaryBrand,
            status: project.status,
            geoDailyEnabled: project.geoDailyEnabled,
          },
          resources: {
            keywords: keywordCount,
            geoQuestions: questionCount,
            brands: brandCount,
            competitors: competitorCount,
            pages: pageCount,
          },
          tasks: { open: taskOpenCount },
          geo: {
            totalRuns: geoRunCount,
            successRuns: successRunCount,
            successRate: geoRunCount > 0 ? Math.round((successRunCount / geoRunCount) * 100) : 0,
            score: geoMetrics?.score ?? 0,
            brandMentioned: geoMetrics?.brandMentioned ?? 0,
            trend: geoMetrics?.trend ?? "stable",
          },
          seo: {
            avgScore: Math.round(pageAuditAgg._avg.score ?? 0),
          },
          createdAt: project.createdAt,
        };
      }),
    );

    return success({
      projects: results.filter((r) => r !== null),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}