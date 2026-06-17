// 分发队列（BullMQ）。
// 用于 AUTO 模式：草稿 APPROVED 时自动 enqueue。
import { Queue } from "bullmq";
import { connection } from "./connection";

export interface DistributionJob {
  draftId: string;
  targetId: string;
  userId?: string;
  triggerType: "AUTO_APPROVED" | "MANUAL" | "RETRY";
}

export const distributionQueue = new Queue<DistributionJob>("distribution", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
    removeOnFail: { age: 60 * 24 * 3600 },
  },
});

export async function enqueueDistribution(job: DistributionJob) {
  // BullMQ jobId 不能包含 :
  const safeDraftId = job.draftId.replace(/:/g, "_");
  const safeTargetId = job.targetId.replace(/:/g, "_");
  return distributionQueue.add("distribute", job, {
    jobId: `dist-${safeDraftId}-${safeTargetId}-${Date.now()}`,
  });
}

export async function enqueueAutoDistribution(draftId: string, targetId: string) {
  return enqueueDistribution({ draftId, targetId, triggerType: "AUTO_APPROVED" });
}
