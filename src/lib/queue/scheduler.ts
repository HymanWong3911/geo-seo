// 调度器队列。
// 详细说明见 dev doc v1.2 26.1 节。
import { Queue } from "bullmq";
import { connection } from "./connection";

export interface SchedulerJob {
  type: "daily-geo-monitor" | "daily-summary" | "retention-cleanup";
}

export const schedulerQueue = new Queue<SchedulerJob>("scheduler", {
  connection,
  defaultJobOptions: {
    removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

// 每日 00:30 触发 GEO 监测
export async function setupScheduler() {
  await schedulerQueue.add(
    "daily-geo-monitor",
    { type: "daily-geo-monitor" },
    {
      repeat: { pattern: "30 0 * * *" },
      jobId: "daily-geo-monitor",
    },
  );

  // 每日 09:00 触发告警汇总
  await schedulerQueue.add(
    "daily-summary",
    { type: "daily-summary" },
    {
      repeat: { pattern: "0 9 * * *" },
      jobId: "daily-summary",
    },
  );

  // 每月 1 日 03:00 数据归档
  await schedulerQueue.add(
    "retention-cleanup",
    { type: "retention-cleanup" },
    {
      repeat: { pattern: "0 3 1 * *" },
      jobId: "retention-cleanup",
    },
  );
}
