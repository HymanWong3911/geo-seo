// /api/dashboard/cost-forecast:基于当前 burn rate 推算 30 天/月度总成本。
// 给投资人 demo 用:展示项目可持续运营成本估算。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const days = parsed.data.days;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const agg = await prisma.llmCall.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { costCents: true },
      _count: { id: true },
    });
    const totalCostCents = Number(agg._sum.costCents ?? 0);
    const totalCalls = agg._count.id;

    // 按 model 拆
    const byModel = await prisma.llmCall.groupBy({
      by: ["model", "provider"],
      where: { createdAt: { gte: since } },
      _sum: { costCents: true },
      _count: { id: true },
      orderBy: { _sum: { costCents: "desc" } },
    });

    // 按天拆
    const byDay = await prisma.$queryRaw<Array<{ day: Date; cost: number; calls: bigint }>>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS day,
        COALESCE(SUM("costCents"), 0)::float AS cost,
        COUNT(*)::bigint AS calls
      FROM "LlmCall"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day DESC
    `;

    // 计算 burn rate
    const dailyAvgCost = days > 0 ? totalCostCents / days : 0;
    const dailyAvgCalls = days > 0 ? totalCalls / days : 0;
    const projectedMonthlyCostCents = Math.round(dailyAvgCost * 30);
    const projectedYearlyCostCents = Math.round(dailyAvgCost * 365);

    return success({
      range: { days, since: since.toISOString() },
      observed: {
        costCents: totalCostCents,
        costYuan: Number((totalCostCents / 100).toFixed(2)),
        calls: totalCalls,
        dailyAvgCostCents: Math.round(dailyAvgCost * 100) / 100,
        dailyAvgCalls: Math.round(dailyAvgCalls * 10) / 10,
      },
      forecast: {
        monthlyCents: projectedMonthlyCostCents,
        monthlyYuan: Number((projectedMonthlyCostCents / 100).toFixed(2)),
        yearlyCents: projectedYearlyCostCents,
        yearlyYuan: Number((projectedYearlyCostCents / 100).toFixed(2)),
        note: "基于过去 N 天 burn rate 线性外推。真实月度成本受 LLM 套餐折扣/限额影响。",
      },
      byModel: byModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        calls: m._count.id,
        costCents: Number(m._sum.costCents ?? 0),
        pct: totalCostCents > 0 ? Math.round((Number(m._sum.costCents ?? 0) / totalCostCents) * 100) : 0,
      })),
      byDay: byDay.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        costCents: Number(d.cost),
        calls: Number(d.calls),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
