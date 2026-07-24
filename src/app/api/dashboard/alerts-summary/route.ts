// /api/dashboard/alerts-summary: 投资人 demo 顶部告警摘要 widget。
// 聚合 alertEvent 数量(成功/失败/未读) + 24h trend,加最新 3 条事件。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

export async function GET(_req: NextRequest) {
  try {
    await requireSession();
    const since24h = new Date(Date.now() - 24 * 3600 * 1000);

    const [totals, last24h, recent] = await Promise.all([
      prisma.alertEvent.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.alertEvent.count({ where: { createdAt: { gte: since24h } } }),
      prisma.alertEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { channel: { select: { name: true, type: true } } },
      }),
    ]);

    const statusTotals = {
      SUCCESS: 0,
      FAILED: 0,
      PENDING: 0,
    };
    for (const t of totals) {
      statusTotals[t.status as keyof typeof statusTotals] = t._count.id;
    }

    return success({
      totals: statusTotals,
      last24h,
      recent: recent.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        status: r.status,
        errorMessage: r.errorMessage,
        channel: r.channel,
        createdAt: r.createdAt.toISOString(),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
