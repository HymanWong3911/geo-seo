// 系统健康端点。
// 提供：数据库 + Redis + 关键计数 + 最近一次 GEO run + Worker 队列状态 + LLM 用量统计
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { connection } from "@/lib/queue";
import { getAllChannelsDiagnostics } from "@/lib/search";
import { Queue } from "bullmq";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckResult {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

async function time<T>(fn: () => Promise<T>): Promise<{ result?: T; error?: string; latencyMs: number }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { result, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - t0 };
  }
}

// BullMQ 队列列表（与 src/workers/index.ts 保持一致）
const QUEUE_NAMES = [
  "geo-run",
  "page-audit",
  "content-analysis",
  "report",
  "scheduler",
  "retention",
  "cms-publish",
  "distribution",
  "alert-sender",
];

async function getQueueStats() {
  const stats: Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }> = {};
  for (const name of QUEUE_NAMES) {
    try {
      const q = new Queue(name, { connection });
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getCompletedCount(),
        q.getFailedCount(),
        q.getDelayedCount(),
      ]);
      stats[name] = { waiting, active, completed, failed, delayed };
      await q.close();
    } catch (e) {
      stats[name] = { waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
    }
  }
  return stats;
}

export async function GET() {
  const [db, counts, redis, lastRun, llmStats24h, channels, queueStats] = await Promise.all([
    time(() => prisma.$queryRaw`SELECT 1 AS ok`),
    time(() =>
      Promise.all([
        prisma.project.count(),
        prisma.geoRun.count(),
        prisma.geoRunResult.count(),
        prisma.brandMention.count(),
        prisma.llmCall.count(),
        prisma.contentDraft.count(),
      ]),
    ),
    time(async () => {
      const pong = await connection.ping();
      if (pong !== "PONG") throw new Error(`unexpected ping: ${pong}`);
      return pong;
    }),
    time(() =>
      prisma.geoRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, finishedAt: true },
      }),
    ),
    time(async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const [calls, agg] = await Promise.all([
        prisma.llmCall.count({ where: { createdAt: { gte: since } } }),
        prisma.llmCall.aggregate({
          where: { createdAt: { gte: since } },
          _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
        }),
      ]);
      const grouped = await prisma.llmCall.groupBy({
        by: ["provider"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        _sum: { totalTokens: true, costCents: true },
      });
      return {
        calls24h: calls,
        tokens24h: {
          prompt: agg._sum.promptTokens ?? 0,
          completion: agg._sum.completionTokens ?? 0,
          total: agg._sum.totalTokens ?? 0,
        },
        costCents24h: agg._sum.costCents ?? 0,
        byProvider: Object.fromEntries(
          grouped.map((g) => [
            g.provider,
            { calls: g._count.id, tokens: g._sum.totalTokens ?? 0, costCents: g._sum.costCents ?? 0 },
          ]),
        ),
      };
    }),
    time(async () => getAllChannelsDiagnostics()),
    time(() => getQueueStats()),
  ]);

  const buildChecks = (r: { result?: unknown; error?: string; latencyMs: number }): CheckResult => ({
    ok: !r.error,
    latencyMs: r.latencyMs,
    detail: r.error,
  });

  const dbCheck = buildChecks(db);
  const redisCheck = buildChecks(redis);
  const countsCheck = buildChecks(counts);
  const lastRunCheck = buildChecks(lastRun);
  const llmCheck = buildChecks(llmStats24h);
  const channelCheck = buildChecks(channels);
  const queueCheck = buildChecks(queueStats);

  const allOk = dbCheck.ok && redisCheck.ok && countsCheck.ok && redisCheck.ok;

  // 渠道状态：任何可用渠道即 OK
  const availableChannels = Object.entries((channels.result ?? {}) as Record<string, { isAvailable: boolean }>)
    .filter(([, v]) => v?.isAvailable)
    .map(([k]) => k);

  const arr = (counts.result as number[] | undefined) ?? [0, 0, 0, 0, 0, 0];
  const [projectCount, geoRunCount, geoRunResultCount, brandMentionCount, llmCallCount, contentDraftCount] = arr;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: "geo-seo",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
        counts: countsCheck,
        lastRun: lastRunCheck,
        llmUsage24h: llmCheck,
        channels: { ...channelCheck, availableChannels },
        queues: queueCheck,
      },
      data: {
        projectCount,
        geoRunCount,
        geoRunResultCount,
        brandMentionCount,
        llmCallCount,
        contentDraftCount,
        lastGeoRun: lastRun.result ?? null,
        llmStats24h: llmStats24h.result ?? null,
        queueStats: queueStats.result ?? null,
        availableChannels,
      },
    },
    { status: allOk ? 200 : 503 },
  );
}
