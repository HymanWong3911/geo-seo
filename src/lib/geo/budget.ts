// 月度预算控制。
// 详细说明见 dev doc v1.1 18.11 节。
import { prisma } from "@/lib/db";

export interface BudgetStatus {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  exceeded: boolean;
  shouldAlert: boolean;
  alertThreshold: number;
}

export async function checkMonthlyBudget(): Promise<BudgetStatus> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agg = await prisma.llmCall.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { costCents: true },
  });

  const used = Number(agg._sum.costCents ?? 0);
  const limit = parseInt(process.env.GEO_BUDGET_MONTHLY_CENTS ?? "10000");
  const alertThresholdRatio = parseFloat(
    process.env.GEO_BUDGET_ALERT_THRESHOLD ?? "0.8",
  );
  const alertThreshold = limit * alertThresholdRatio;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentUsed: limit > 0 ? used / limit : 0,
    exceeded: used >= limit,
    shouldAlert: used >= alertThreshold && used < limit,
    alertThreshold,
  };
}
