// 仪表盘汇总数据。
// 当前显示页面诊断 + GEO 监测的核心指标。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";

// 近30天 GEO 评分趋势数据点
// 2026-07-23: 之前误用 r.score(GeoRunResult 模型没有 score 字段),改成「主品牌被
// AI 回答中提及的占比」即 mentionRate — 这是真实可观测的指标,直接出真实数字。
async function getGeoTrend(projectIds: string[]) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const runs = await prisma.geoRun.findMany({
    where: {
      projectId: { in: projectIds },
      finishedAt: { gte: thirtyDaysAgo },
    },
    select: { finishedAt: true, status: true, results: { select: { primaryBrandMentioned: true } } },
    orderBy: { finishedAt: "asc" },
  });

  // 按天聚合:avg mentionRate (%) = sum(primaryBrandMentioned) / total results × 100
  const byDay: Record<string, { total: number; count: number }> = {};
  for (const r of runs) {
    if (!r.finishedAt) continue;
    const day = r.finishedAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
    const total = r.results.length;
    if (total > 0) {
      const mentioned = r.results.filter((x) => x.primaryBrandMentioned).length;
      byDay[day].total += (mentioned / total) * 100;
      byDay[day].count += 1;
    }
  }

  return Object.entries(byDay).map(([date, { total, count }]) => ({
    date,
    score: count > 0 ? Math.round(total / count) : 0,
  }));
}

// 近30天 LLM 成本趋势数据点
async function getLlmCostTrend(projectIds: string[]) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const calls = await prisma.llmCall.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true, costCents: true },
    orderBy: { createdAt: "asc" },
  });

  // 按天聚合
  const byDay: Record<string, number> = {};
  for (const c of calls) {
    const day = c.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = 0;
    byDay[day] += Number(c.costCents ?? 0) / 100;
  }

  return Object.entries(byDay).map(([date, cost]) => ({ date, cost: Math.round(cost * 1000) / 1000 }));
}

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession();
    const projectIds = await listUserProjectIds(session.user.id, session.user.role);
    if (projectIds.length === 0) {
      return success({
        total: 0,
        avgScore: 0,
        highFindings: 0,
        recent: [],
        geo: { score: 0, trend: "stable", totalQuestions: 0, brandMentioned: 0 },
        llmCostThisMonth: 0,
        pendingTasks: 0,
        geoTrend: [],
        llmCostTrend: [],
      });
    }

    const pageIds = await prisma.page.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const pageIdList = pageIds.map((p) => p.id);

    const [total, scoreAgg, recent, allFindings, pendingTasks, llmCost, geoTrend, llmCostTrend] = await Promise.all([
      prisma.pageAudit.count({ where: { pageId: { in: pageIdList } } }),
      prisma.pageAudit.aggregate({
        where: { pageId: { in: pageIdList } },
        _avg: { score: true },
      }),
      prisma.pageAudit.findMany({
        where: { pageId: { in: pageIdList } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          page: { select: { id: true, url: true, title: true } },
        },
      }),
      prisma.pageAudit.findMany({
        where: {
          pageId: { in: pageIdList },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        },
        select: { findings: true },
      }),
      prisma.optimizationTask.count({
        where: { projectId: { in: projectIds }, status: { in: ["TODO", "DOING"] } },
      }),
      prisma.llmCall.aggregate({
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { costCents: true },
      }),
      getGeoTrend(projectIds),
      getLlmCostTrend(projectIds),
    ]);

    // 统计近 7 天 high 严重度问题数
    let highFindings = 0;
    for (const a of allFindings) {
      const findings = a.findings as Array<{ severity?: string }>;
      highFindings += findings.filter((f) => f.severity === "high").length;
    }

    // 计算所有项目的 GEO 指标（取平均）
    let geoTotal = { score: 0, totalQuestions: 0, brandMentioned: 0 };
    const trends: Array<"up" | "down" | "stable"> = [];
    for (const pid of projectIds) {
      try {
        const m = await calculateProjectGeoMetrics(pid);
        geoTotal.score += m.score;
        geoTotal.totalQuestions += m.totalQuestions;
        geoTotal.brandMentioned += m.brandMentioned;
        trends.push(m.trend);
      } catch {
        // 单项目失败不影响其他
      }
    }
    const avgScore = projectIds.length > 0 ? Math.round(geoTotal.score / projectIds.length) : 0;
    const upCount = trends.filter((t) => t === "up").length;
    const downCount = trends.filter((t) => t === "down").length;
    const trend: "up" | "down" | "stable" =
      upCount > downCount ? "up" : downCount > upCount ? "down" : "stable";

    const data = {
      total,
      avgScore: Math.round(scoreAgg._avg.score ?? 0),
      highFindings,
      recent,
      geo: {
        score: avgScore,
        trend,
        totalQuestions: geoTotal.totalQuestions,
        brandMentioned: geoTotal.brandMentioned,
      },
      llmCostThisMonth: Number(llmCost._sum.costCents ?? 0) / 100,
      pendingTasks,
      geoTrend,
      llmCostTrend,
    };

    // 2026-07-23:加 ETag + 30s 缓存。Dashboard 端每 30s 轮询,减少 DB 压力。
    // 用 data 的 JSON 序列化做 hash。304 命中不重算。
    const crypto = await import("node:crypto");
    const payload = { data, error: null };
    const json = JSON.stringify(payload);
    const etag = '"' + crypto.createHash("md5").update(json).digest("hex") + '"';
    if (_req.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "max-age=30, must-revalidate" },
      });
    }
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": "max-age=30, must-revalidate",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
