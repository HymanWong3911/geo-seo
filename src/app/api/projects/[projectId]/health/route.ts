// 项目综合健康度评分。
// 5 维度各 0-100 → 加权总分。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectEditor, requireSession } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const projectId = params.projectId;

    const [
      project,
      pageAuditAgg,
      recentAudits,
      taskCounts,
      latestGeoRun,
      brandMentionCounts,
      keywordCount,
      questionCount,
      last7dRuns,
      geoMetrics,
    ] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.pageAudit.aggregate({
        where: { page: { projectId } },
        _avg: { score: true },
        _count: true,
      }),
      prisma.pageAudit.findMany({
        where: { page: { projectId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { findings: true },
      }),
      prisma.optimizationTask.groupBy({
        by: ["status"],
        where: { projectId },
        _count: true,
      }),
      prisma.geoRun.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.brandMention.count({ where: { projectId } }),
      prisma.keyword.count({ where: { projectId } }),
      prisma.geoQuestion.count({ where: { projectId, active: true } }),
      prisma.geoRun.count({
        where: {
          projectId,
          createdAt: { gte: new Date(Date.now() - 7 * DAY) },
        },
      }),
      calculateProjectGeoMetrics(projectId).catch(() => null),
    ]);

    if (!project) throw Errors.notFound("项目");

    // === 维度 1: SEO 健康度（最近审计均分）===
    const seoScore = Math.round(pageAuditAgg._avg.score ?? 0);

    // === 维度 2: GEO 健康度（评分 0-100）===
    const geoScore = geoMetrics?.score ?? 0;

    // === 维度 3: 任务完成率（已 DONE / 总数）===
    const taskTotal = taskCounts.reduce((s, t) => s + t._count, 0);
    const taskDone = taskCounts.find((t) => t.status === "DONE")?._count ?? 0;
    const taskCompletion = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 100;

    // === 维度 4: 监测新鲜度（最近 GEO run 距今多久）===
    let freshness = 0;
    if (latestGeoRun) {
      const ageMs = Date.now() - new Date(latestGeoRun.createdAt).getTime();
      const ageDays = ageMs / DAY;
      if (ageDays < 1) freshness = 100;
      else if (ageDays < 3) freshness = 80;
      else if (ageDays < 7) freshness = 60;
      else if (ageDays < 30) freshness = 30;
      else freshness = 10;
    } else {
      freshness = 0;  // 从未跑过
    }

    // === 维度 5: 资源完整度（关键词 + 问题 + 品牌 + 提及）===
    const resourceScore = Math.min(
      100,
      keywordCount * 2 +
        questionCount * 3 +
        brandMentionCounts * 5,
    );

    // === 总分（加权平均）===
    const weights = {
      seo: 0.25,
      geo: 0.3,
      tasks: 0.15,
      freshness: 0.15,
      resources: 0.15,
    };
    const totalScore = Math.round(
      seoScore * weights.seo +
        geoScore * weights.geo +
        taskCompletion * weights.tasks +
        freshness * weights.freshness +
        resourceScore * weights.resources,
    );

    // 风险信号
    const issues: Array<{ severity: "high" | "medium" | "low"; title: string; detail: string }> = [];
    if (seoScore < 60 && pageAuditAgg._count > 0) {
      issues.push({
        severity: "high",
        title: "SEO 分数偏低",
        detail: `最近 ${pageAuditAgg._count} 次审计平均分仅 ${seoScore}`,
      });
    }
    if (geoScore < 30) {
      issues.push({
        severity: "high",
        title: "GEO 评分不足 30",
        detail: "主品牌在 AI 搜索中被引用很少",
      });
    }
    if (taskTotal > 0 && taskCompletion < 30) {
      issues.push({
        severity: "medium",
        title: "任务积压",
        detail: `${taskTotal - taskDone} 个任务未完成，完成率仅 ${taskCompletion}%`,
      });
    }
    if (freshness === 0) {
      issues.push({
        severity: "high",
        title: "从未跑过 GEO 监测",
        detail: "点击「GEO 监测」→「立即跑一次」开始第一次扫描",
      });
    } else if (freshness < 60) {
      issues.push({
        severity: "medium",
        title: "监测新鲜度不足",
        detail: "建议每天至少跑一次 GEO 监测",
      });
    }
    if (keywordCount < 5) {
      issues.push({
        severity: "low",
        title: "关键词不足",
        detail: `仅 ${keywordCount} 个，建议至少 5-10 个`,
      });
    }
    if (questionCount < 3) {
      issues.push({
        severity: "low",
        title: "GEO 问题不足",
        detail: `仅 ${questionCount} 个，建议至少 3-5 个`,
      });
    }

    return success({
      totalScore,
      level: totalScore >= 80 ? "excellent" : totalScore >= 60 ? "good" : totalScore >= 40 ? "warning" : "critical",
      dimensions: {
        seo: { score: seoScore, weight: weights.seo, audits: pageAuditAgg._count },
        geo: { score: geoScore, weight: weights.geo, totalQuestions: geoMetrics?.totalQuestions ?? 0, brandMentioned: geoMetrics?.brandMentioned ?? 0, runs7d: last7dRuns },
        tasks: { completion: taskCompletion, weight: weights.tasks, total: taskTotal, done: taskDone, byStatus: Object.fromEntries(taskCounts.map((t) => [t.status, t._count])) },
        freshness: { score: freshness, weight: weights.freshness, lastRunAt: latestGeoRun?.createdAt ?? null },
        resources: {
          score: resourceScore,
          weight: weights.resources,
          keywords: keywordCount,
          geoQuestions: questionCount,
          brandMentions: brandMentionCounts,
        },
      },
      issues,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}