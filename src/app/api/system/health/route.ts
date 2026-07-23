// 系统健康 JSON 端点(供 API-only 客户端调用)。
// 与 /system/health 页面版对应;页面版走 Next.js SSR,API 版走 JSON。
// 2026-07-23: 之前缺失,补齐。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { Queue } from "bullmq";
import { connection } from "@/lib/queue";

const querySchema = z.object({
  projectId: z.string().optional(),
});

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

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000);

    // 1) 关键计数
    const [
      projectCount,
      geoRunCount24h,
      geoRunResultCount,
      brandMentionCount,
      llmCallCount24h,
      contentDraftCount,
      lastGeoRun,
      failedRuns24h,
    ] = await Promise.all([
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.geoRun.count({ where: { createdAt: { gte: since } } }),
      prisma.geoRunResult.count(),
      prisma.brandMention.count(),
      prisma.llmCall.count({ where: { createdAt: { gte: since } } }),
      prisma.contentDraft.count(),
      prisma.geoRun.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, finishedAt: true } }),
      prisma.geoRun.count({ where: { createdAt: { gte: since }, status: "FAILED" } }),
    ]);

    // 2) 队列 worker 状态(直接连 BullMQ,不要求 worker 进程存在也能看)
    const queues: Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }> = {};
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
        queues[name] = { waiting, active, completed, failed, delayed };
        await q.close();
      } catch {
        queues[name] = { waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
      }
    }

    // 3) LLM 24h stats
    const llm = await prisma.llmCall.aggregate({
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _sum: { totalTokens: true, costCents: true },
    });

    // 4) worker 进程是否在跑 — 探测 tsx child of bash
    const { execSync } = await import("node:child_process");
    let workerProcs = 0;
    try {
      const out = execSync("pgrep -fl 'tsx.*workers/index' | wc -l", { encoding: "utf8", timeout: 2000 });
      workerProcs = parseInt(out.trim(), 10) || 0;
    } catch {
      workerProcs = -1;
    }

    return success({
      counts: {
        projectCount,
        geoRunCount24h,
        geoRunResultCount,
        brandMentionCount,
        llmCallCount24h,
        contentDraftCount,
        failedRuns24h,
      },
      lastGeoRun,
      queues,
      workerProcesses: workerProcs,
      llm24h: {
        calls: llm._count.id,
        tokens: llm._sum.totalTokens ?? 0,
        costCents: Number(llm._sum.costCents ?? 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
