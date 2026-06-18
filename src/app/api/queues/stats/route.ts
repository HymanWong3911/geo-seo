// BullMQ 队列健康检查端点。
// 提供各队列的等待/活跃/失败/延迟任务数,用于 worker 监控。
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api/auth";
import { Queue } from "bullmq";
import { connection } from "@/lib/queue";
import { handleError } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET() {
  try {
    await requireSession();

    const stats: Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }> = {};
    const errors: string[] = [];

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
        errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        stats[name] = { waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
      }
    }

    // 总览
    const total = Object.values(stats).reduce(
      (acc, s) => ({
        waiting: acc.waiting + Math.max(0, s.waiting),
        active: acc.active + Math.max(0, s.active),
        completed: acc.completed + Math.max(0, s.completed),
        failed: acc.failed + Math.max(0, s.failed),
        delayed: acc.delayed + Math.max(0, s.delayed),
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
    );

    // 找出有积压的队列
    const backlog = Object.entries(stats)
      .filter(([, s]) => s.waiting > 0 || s.delayed > 0)
      .map(([name, s]) => ({ queue: name, waiting: s.waiting, delayed: s.delayed }))
      .sort((a, b) => (b.waiting + b.delayed) - (a.waiting + a.delayed));

    // 找出高失败率队列
    const failureHotspots = Object.entries(stats)
      .filter(([, s]) => s.failed > 0)
      .map(([name, s]) => ({ queue: name, failed: s.failed }))
      .sort((a, b) => b.failed - a.failed);

    return NextResponse.json({
      data: {
        queues: stats,
        total,
        backlog,
        failureHotspots,
        errors: errors.length > 0 ? errors : null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
