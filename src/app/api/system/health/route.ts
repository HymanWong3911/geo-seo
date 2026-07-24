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

    // 4) worker 进程是否在跑 — 探测 tsx child of bash,返回每个进程的 pid + uptime
    const { execSync } = await import("node:child_process");
    let workerProcs = 0;
    const workers: Array<{ pid: number; uptimeSec: number; cmd: string }> = [];
    try {
      const out = execSync("pgrep -fl 'tsx.*workers/index' || true", { encoding: "utf8", timeout: 2000 });
      const lines = out.split("\n").filter((l: string) => l.trim().length > 0);
      workerProcs = lines.length;
      for (const line of lines) {
        // 格式: PID CMD
        const m = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!m) continue;
        const pid = parseInt(m[1], 10);
        try {
          const elapsed = execSync(
            `ps -o etime= -p ${pid} 2>/dev/null | tail -1 | tr -d ' '`,
            { encoding: "utf8", timeout: 1000 },
          );
          // etime 格式 [[DD-]HH:]MM:SS,转秒
          const parts = elapsed.split(/[-:]/);
          let sec = 0;
          if (parts.length === 4) sec = parseInt(parts[0]) * 86400 + parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60 + parseInt(parts[3]);
          else if (parts.length === 3) sec = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
          else if (parts.length === 2) sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          workers.push({ pid, uptimeSec: sec, cmd: m[2].slice(0, 60) });
        } catch {
          workers.push({ pid, uptimeSec: -1, cmd: m[2].slice(0, 60) });
        }
      }
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
      workers,
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
