// /api/dashboard/brand-trend:近 N 天 brand mention 数量 + sentiment 趋势。
// 投资人 demo 用:dashboard 顶部 "品牌监控趋势" widget 显示真实数据。
// 2026-07-25 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, resolveAccessibleProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  projectId: z.string().optional(),
});

const DAY = 24 * 3600 * 1000;

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      days: url.searchParams.get("days") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
    });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const { days, projectId } = parsed.data;
    const since = new Date(Date.now() - days * DAY);
    const projectIds = await resolveAccessibleProjectIds(
      session.user.id,
      session.user.role,
      projectId,
    );

    if (projectIds.length === 0) {
      return success({
        range: { days, since: since.toISOString() },
        totals: { mentions: 0, avgRelevance: 0, last24h: 0 },
        byDay: [],
        topBrands: [],
        sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 },
        timestamp: new Date().toISOString(),
      });
    }

    // 按天分桶 brand mention 数量 + sentiment
    // 2026-07-25:用普通 SQL 字符串 + 参数化。Prisma.$queryRaw 的 tagged template
    // 跟动态条件拼接有 TS parser 兼容问题,所以 Prisma.sql + $queryRawUnsafe 路径。
    const rows = await prisma.$queryRaw<Array<{
      day: Date;
      total: bigint;
      positive: bigint;
      neutral: bigint;
      negative: bigint;
      primary: bigint;
      competitor: bigint;
    }>>(Prisma.sql`
      SELECT DATE_TRUNC('day', "discoveredAt") AS day,
        COUNT(*)::bigint AS total,
        SUM(CASE WHEN "sentiment" = 'positive' THEN 1 ELSE 0 END)::bigint AS positive,
        SUM(CASE WHEN "sentiment" = 'neutral' THEN 1 ELSE 0 END)::bigint AS neutral,
        SUM(CASE WHEN "sentiment" = 'negative' THEN 1 ELSE 0 END)::bigint AS negative,
        SUM(CASE WHEN "mentionType" = 'primary_brand' THEN 1 ELSE 0 END)::bigint AS primary,
        SUM(CASE WHEN "mentionType" = 'competitor' THEN 1 ELSE 0 END)::bigint AS competitor
      FROM "BrandMention"
      WHERE "discoveredAt" >= ${since}
        AND "projectId" IN (${Prisma.join(projectIds)})
      GROUP BY DATE_TRUNC('day', "discoveredAt")
      ORDER BY day ASC
    `);

    // 当前快照(总数 + 24h)
    const where = {
      discoveredAt: { gte: since },
      projectId: { in: projectIds },
    };
    const [totals, last24h, byBrand, bySentiment] = await Promise.all([
      prisma.brandMention.aggregate({
        where,
        _count: { id: true },
        _sum: { relevanceScore: true },
      }),
      prisma.brandMention.count({
        where: {
          discoveredAt: { gte: new Date(Date.now() - DAY) },
          projectId: { in: projectIds },
        },
      }),
      prisma.brandMention.groupBy({
        by: ["brandName"],
        where,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.brandMention.groupBy({
        by: ["sentiment"],
        where,
        _count: { id: true },
      }),
    ]);

    const byDay = rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      total: Number(r.total),
      positive: Number(r.positive),
      neutral: Number(r.neutral),
      negative: Number(r.negative),
      primary: Number(r.primary),
      competitor: Number(r.competitor),
    }));

    const sentimentMap = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    for (const s of bySentiment) {
      const k = (s.sentiment ?? "neutral") as keyof typeof sentimentMap;
      sentimentMap[k] = s._count.id;
    }

    const totalCount = totals._count.id;
    const relevanceSum = Number(totals._sum.relevanceScore ?? 0);
    const avgRelevance = totalCount > 0 ? Math.round(relevanceSum / totalCount) : 0;
    return success({
      range: { days, since: since.toISOString() },
      totals: {
        mentions: totalCount,
        avgRelevance,
        last24h,
      },
      byDay,
      topBrands: byBrand.map((b) => ({ brandName: b.brandName, count: b._count.id })),
      sentiment: sentimentMap,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
