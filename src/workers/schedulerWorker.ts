// 调度器 worker。
// 详细说明见 dev doc v1.2 26.1 节。
import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { enqueueGeoRun } from "@/lib/queue/geo";
import { sendDailySummary, sendAlert } from "@/lib/alert/sender";
import { checkMonthlyBudget } from "@/lib/geo/budget";
import type { SchedulerJob } from "@/lib/queue/scheduler";
import { runRetentionCleanup } from "./retentionWorker";

export async function runDailyGeoMonitor() {
  console.log("[scheduler] daily geo monitor starting...");

  const budget = await checkMonthlyBudget();
  if (budget.exceeded && process.env.GEO_BUDGET_HARD_LIMIT === "true") {
    await sendAlert({
      eventType: "GEO_RUN_FAILED",
      payload: {
        title: "【GEO 监测跳过】月度预算已用完",
        月度预算: `¥${(budget.limit / 100).toFixed(2)}`,
        已用: `¥${(budget.used / 100).toFixed(2)}`,
      },
    });
    return;
  }

  // 查询启用 GEO 监测的项目
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE", geoDailyEnabled: true },
    select: { id: true, name: true },
  });

  console.log(`[scheduler] scheduling ${projects.length} projects`);

  let successCount = 0;
  let failedCount = 0;
  const failedProjects: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    // 错峰：每个项目延迟 (i+1) * 60 秒
    const delay = (i + 1) * 60 * 1000;

    try {
      await enqueueGeoRun({
        projectId: project.id,
        triggerType: "SCHEDULED",
      }, { delay });
      successCount++;
    } catch (err) {
      failedCount++;
      failedProjects.push({
        name: project.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `[scheduler] daily geo monitor scheduled: ${successCount} queued, ${failedCount} failed`,
  );
  if (failedProjects.length > 0) {
    console.error("[scheduler] projects failed to enqueue:", failedProjects);
  }
}

export async function runDailySummary() {
  console.log("[scheduler] daily summary starting...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [successCount, failedCount, failedRuns, llmCost] = await Promise.all([
    prisma.geoRun.count({ where: { status: "SUCCESS", createdAt: { gte: today } } }),
    prisma.geoRun.count({ where: { status: { in: ["FAILED", "PARTIAL_FAILURE"] }, createdAt: { gte: today } } }),
    prisma.geoRun.findMany({
      where: { status: "FAILED", createdAt: { gte: today } },
      include: { project: { select: { name: true } } },
      take: 10,
    }),
    prisma.llmCall.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { costCents: true },
    }),
  ]);

  const projectCount = await prisma.project.count({ where: { status: "ACTIVE" } });

  await sendDailySummary({
    projectCount,
    successCount,
    failedCount,
    failedProjects: failedRuns.map((r) => ({
      name: r.project.name,
      error: r.errorMessage ?? "未知错误",
    })),
    totalCost: Number(llmCost._sum.costCents ?? 0) / 100,
  });
}

export async function processSchedulerJob(job: SchedulerJob) {
  if (job.type === "daily-geo-monitor") return runDailyGeoMonitor();
  if (job.type === "daily-summary") return runDailySummary();
  if (job.type === "retention-cleanup") return runRetentionCleanup();
  throw new Error(`Unknown scheduler job type: ${String((job as { type?: unknown }).type)}`);
}

export function createSchedulerWorker() {
  return new Worker<SchedulerJob>(
    "scheduler",
    async (job) => processSchedulerJob(job.data),
    { connection, concurrency: 1 },
  );
}
