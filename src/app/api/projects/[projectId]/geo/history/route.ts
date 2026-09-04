// 单项目 GEO 监测历史:近 N 天的 run + mention rate + 成本时序。
// 投资人 demo 用 — 单项目时间序列视图。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const period = parsed.data.days;
    const since = new Date(Date.now() - period * 24 * 3600 * 1000);

    const runs = await prisma.geoRun.findMany({
      where: {
        projectId: params.projectId,
        createdAt: { gte: since },
      },
      select: { id: true, status: true, finishedAt: true, createdAt: true, totalQuestions: true, answeredQuestions: true },
      orderBy: { createdAt: "asc" },
    });

    // 按天聚合
    const byDay: Record<string, {
      totalRuns: number;
      successRuns: number;
      questionCount: number;
  mentionedCount: number;
  }> = {};
    for (const r of runs) {
      const day = r.createdAt.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { totalRuns: 0, successRuns: 0, questionCount: 0, mentionedCount: 0 };
      byDay[day].totalRuns += 1;
      if (r.status === "SUCCESS") byDay[day].successRuns += 1;
      byDay[day].questionCount += r.totalQuestions ?? 0;
      byDay[day].mentionedCount += r.answeredQuestions ?? 0;
    }

    // 单独查每天的 primaryBrandMentioned 计数(GeoRunResult 没 projectId 列,走 geoRun 关联)
    const mentionRows = await prisma.$queryRaw<Array<{
      day: Date;
      total: bigint;
      mentioned: bigint;
      synthetic: bigint;
    }>>`
      SELECT
        DATE_TRUNC('day', gr."createdAt") AS day,
        SUM(CASE WHEN NOT r."isSynthetic" THEN 1 ELSE 0 END)::bigint AS total,
        SUM(CASE WHEN NOT r."isSynthetic" AND r."primaryBrandMentioned" THEN 1 ELSE 0 END)::bigint AS mentioned,
        SUM(CASE WHEN r."isSynthetic" THEN 1 ELSE 0 END)::bigint AS synthetic
      FROM "GeoRunResult" r
      INNER JOIN "GeoRun" gr ON gr.id = r."geoRunId"
      WHERE gr."projectId" = ${params.projectId}
        AND gr."createdAt" >= ${since}
        AND r."primaryBrandMentioned" IS NOT NULL
      GROUP BY DATE_TRUNC('day', gr."createdAt")
    `;
    const byMention = new Map<string, { total: number; mentioned: number; synthetic: number }>();
    for (const r of mentionRows) {
      const day = r.day.toISOString().slice(0, 10);
      byMention.set(day, {
        total: Number(r.total),
        mentioned: Number(r.mentioned),
        synthetic: Number(r.synthetic),
      });
    }

    // 关联 LlmCall:每天的总 cost cents
    const costRows = await prisma.$queryRaw<Array<{
      day: Date;
      cost: number;
    }>>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COALESCE(SUM("costCents"), 0)::float AS cost
      FROM "LlmCall"
      WHERE "createdAt" >= ${since}
        AND "projectId" = ${params.projectId}
      GROUP BY DATE_TRUNC('day', "createdAt")
    `;
    const byCost = new Map<string, number>();
    for (const c of costRows) {
      const day = c.day.toISOString().slice(0, 10);
      byCost.set(day, c.cost);
    }

    // 合并输出
    const daysList = Array.from(new Set([
      ...Object.keys(byDay),
      ...Array.from(byMention.keys()),
      ...Array.from(byCost.keys()),
    ])).sort();

    const history = daysList.map((day) => {
      const run = byDay[day] ?? { totalRuns: 0, successRuns: 0, questionCount: 0, mentionedCount: 0 };
      const mention = byMention.get(day);
      const mentionRatePct = mention && mention.total > 0
        ? Math.round((mention.mentioned / mention.total) * 100)
        : null;
      return {
        date: day,
        totalRuns: run.totalRuns,
        successRuns: run.successRuns,
        questionsAnswered: mention?.total ?? 0,
        mentionRatePct,
        syntheticExcluded: mention?.synthetic ?? 0,
        llmCostCents: byCost.get(day) ?? 0,
        llmCostYuan: Number(((byCost.get(day) ?? 0) / 100).toFixed(4)),
      };
    });

    const totalRuns = runs.length;
    const successRuns = runs.filter((r) => r.status === "SUCCESS").length;
    const aggregateMention = await prisma.geoRunResult.count({
      where: {
        geoRun: { projectId: params.projectId, createdAt: { gte: since } },
        isSynthetic: false,
      },
    });
    const mentionedAgg = await prisma.geoRunResult.count({
      where: {
        geoRun: { projectId: params.projectId, createdAt: { gte: since } },
        primaryBrandMentioned: true,
        isSynthetic: false,
      },
    });
    const syntheticExcluded = Array.from(byMention.values())
      .reduce((sum, item) => sum + item.synthetic, 0);
    const totalMentions = aggregateMention;
    const avgMentionRatePct = totalMentions > 0 ? Math.round((mentionedAgg / totalMentions) * 100) : 0;

    return success({
      projectId: params.projectId,
      range: { days: period, since: since.toISOString() },
      totals: {
        totalRuns,
        successRuns,
        successRatePct: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        questionsAnswered: totalMentions,
        syntheticExcluded,
        avgMentionRatePct,
        totalMentionedOfTotal: `${mentionedAgg}/${totalMentions}`,
      },
      history,
    });
  } catch (err) {
    return handleError(err);
  }
}
