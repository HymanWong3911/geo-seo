// 页面审计队列（BullMQ）。
// 详细说明见 dev doc v1.2 13.1 节。
import { Queue } from "bullmq";
import { connection } from "./connection";

export interface PageAuditJob {
  projectId: string;
  url: string;
  userId?: string;       // 触发人（手动 vs 自动）
  triggerType: "MANUAL" | "SCHEDULED";
}

export const pageAuditQueue = new Queue<PageAuditJob>("page-audit", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5_000 },
    removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

export async function enqueuePageAudit(job: PageAuditJob) {
  return pageAuditQueue.add("audit", job, {
    jobId: `audit:${job.projectId}:${job.url}:${Date.now()}`,
  });
}
