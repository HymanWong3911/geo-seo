// LLM 用量统计端点。
// 详细说明见 dev doc v1.2 25.3 节。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, resolveAccessibleProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

const querySchema = z.object({
  projectId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(7),
  groupBy: z.enum(["provider", "jobType", "day", "model"]).default("provider"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params", detail: parsed.error.flatten() }), { status: 400 });
    }
    const { projectId, days, groupBy } = parsed.data;

    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const projectIds = await resolveAccessibleProjectIds(
      session.user.id,
      session.user.role,
      projectId,
    );
    const where = {
      createdAt: { gte: since },
      projectId: { in: projectIds },
    };

    const [totals, grouped, byDay, recent] = await Promise.all([
      prisma.llmCall.aggregate({
        where,
        _count: { id: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
        _avg: { durationMs: true },
      }),
      prisma.llmCall.groupBy({
        by: [groupBy === "day" ? "createdAt" : groupBy],
        where,
        _count: { id: true },
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true, costCents: true },
        _avg: { durationMs: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // 按天聚合最近 N 天
      projectIds.length === 0
        ? Promise.resolve([])
        : prisma.$queryRaw<Array<{ day: Date; calls: bigint; tokens: bigint; cost: number }>>(Prisma.sql`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*) AS calls,
          SUM("totalTokens") AS tokens,
          COALESCE(SUM("costCents"), 0)::float AS cost
        FROM "LlmCall"
        WHERE "createdAt" >= ${since}
          AND "projectId" IN (${Prisma.join(projectIds)})
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY day DESC
      `),
      prisma.llmCall.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          jobType: true,
          provider: true,
          model: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          costCents: true,
          durationMs: true,
          success: true,
          createdAt: true,
        },
      }),
    ]);

    return success({
      range: {
        since: since.toISOString(),
        days,
        projectId: projectId ?? null,
      },
      totals: {
        calls: totals._count.id,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        costCents: totals._sum.costCents ?? 0,
        avgDurationMs: Math.round(totals._avg.durationMs ?? 0),
      },
      grouped: grouped.map((g) => {
        const count = typeof g._count === "object" && g._count ? g._count.id ?? 0 : 0;
        return {
          [groupBy]: groupBy === "day"
            ? (g as { createdAt: Date }).createdAt.toISOString().slice(0, 10)
            : (g as Record<string, unknown>)[groupBy],
          calls: count,
          promptTokens: g._sum?.promptTokens ?? 0,
          completionTokens: g._sum?.completionTokens ?? 0,
          totalTokens: g._sum?.totalTokens ?? 0,
          costCents: g._sum?.costCents ?? 0,
          avgDurationMs: Math.round(g._avg?.durationMs ?? 0),
        };
      }),
      daily: byDay.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        calls: Number(d.calls),
        tokens: Number(d.tokens),
        cost: d.cost,
      })),
      recent,
    });
  } catch (err) {
    return handleError(err);
  }
}
