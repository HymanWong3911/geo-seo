// 全局 /api/insights JSON 端点(无 projectId 的"按所有可见项目汇总"视图)。
// 2026-07-23: 新增。和 /api/projects/[projectId]/insights 区分:
//   - /api/projects/{p}/insights: 强权限,要求 ADMIN/MEMBER 能编辑项目
//   - /api/insights:            弱,只要登录就返回当前用户能看见的所有项目的 "摘要"
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession();
    const projectIds = await listUserProjectIds(session.user.id, session.user.role);

    if (projectIds.length === 0) {
      return success({
        totals: { projects: 0, score: 0, questions: 0, brandMentioned: 0, pageAudits: 0, highFindings: 0 },
        projects: [],
        topFindings: [],
        timestamp: new Date().toISOString(),
      });
    }

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    // 每个项目的 GEO 指标 + 页面审计摘要
    const projectRows = await Promise.all(
      projectIds.map(async (id) => {
        const project = await prisma.project.findUnique({
          where: { id },
          select: { id: true, name: true, primaryBrand: true, language: true, region: true },
        });
        if (!project) return null;

        const [metrics, pageAudits, geoRuns30d, successRuns] = await Promise.all([
          calculateProjectGeoMetrics(id).catch(() => ({
            score: 0,
            brandMentioned: 0,
            brandRecommended: 0,
            competitorSuppress: 0,
            officialLink: 0,
            totalQuestions: 0,
            scoreChange: 0,
            trend: "stable" as const,
          })),
          prisma.pageAudit.findMany({
            where: { page: { projectId: id } },
            select: { findings: true },
          }),
          prisma.geoRun.count({ where: { projectId: id, createdAt: { gte: since } } }),
          prisma.geoRun.count({ where: { projectId: id, status: "SUCCESS", createdAt: { gte: since } } }),
        ]);

        let highFindings = 0;
        for (const a of pageAudits) {
          const arr = a.findings as Array<{ severity?: string }>;
          highFindings += arr.filter((f) => f.severity === "high").length;
        }

        return {
          id,
          name: project.name,
          primaryBrand: project.primaryBrand,
          language: project.language,
          region: project.region,
          geo: metrics,
          geoRuns30d,
          geoRunsSuccess30d: successRuns,
          pageAudits: pageAudits.length,
          highFindings,
        };
      }),
    );

    const rows = projectRows.filter((r): r is NonNullable<typeof r> => r !== null);

    const totals = {
      projects: rows.length,
      score: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.geo.score, 0) / rows.length) : 0,
      questions: rows.reduce((s, r) => s + r.geo.totalQuestions, 0),
      brandMentioned: rows.reduce((s, r) => s + r.geo.brandMentioned, 0),
      pageAudits: rows.reduce((s, r) => s + r.pageAudits, 0),
      highFindings: rows.reduce((s, r) => s + r.highFindings, 0),
    };

    // 收集所有 high 严重度 find,作为 topFindings
    const topFindings: Array<{ projectId: string; projectName: string; code: string; severity: string }> = [];
    for (const projectId of projectIds) {
      const audits = await prisma.pageAudit.findMany({
        where: { page: { projectId } },
        select: { findings: true, page: { select: { projectId: true, project: { select: { name: true } } } } },
      });
      for (const a of audits) {
        const arr = a.findings as Array<{ code: string; severity: string }>;
        for (const f of arr) {
          if (f.severity === "high") {
            topFindings.push({
              projectId: a.page.projectId,
              projectName: a.page.project.name,
              code: f.code,
              severity: f.severity,
            });
          }
        }
      }
    }

    // 取最重要的前 10 条
    topFindings.length = Math.min(topFindings.length, 10);

    return success({
      totals,
      projects: rows,
      topFindings,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
