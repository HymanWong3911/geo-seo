// 分发队列 worker（BullMQ Worker）。
// 监听 distribution 队列，处理单个 (draft, target) 分发任务。
import { Worker, Job } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { distributeToTarget } from "@/lib/distribution";
import { getAdapter } from "@/lib/distribution/adapters";
import type { DistributionJob } from "@/lib/queue/distribution";

export const distributionWorker = new Worker<DistributionJob>(
  "distribution",
  async (job: Job<DistributionJob>) => {
    const { draftId, targetId } = job.data;
    const result = await distributeToTarget({ draftId, targetId });
    return result;
  },
  {
    connection,
    concurrency: 5,
  },
);

// 校验目标配置（API 用）
export async function validateTargetConfig(targetId: string) {
  const target = await prisma.distributionTarget.findUnique({ where: { id: targetId } });
  if (!target) return { valid: false, error: "目标不存在" };

  const adapter = getAdapter(target.platform as any);
  if (!adapter) return { valid: false, error: `不支持的平台: ${target.platform}` };

  const config = (target.config as Record<string, unknown>) || {};
  const validation = adapter.validateConfig(config);

  return { valid: validation.valid, missing: validation.missing, platform: target.platform, platformName: adapter.name };
}

// 触发审核状态变更时的自动分发（保留兼容旧 API）
export async function triggerAutoDistribution(draftId: string, newStatus: string) {
  if (newStatus !== "APPROVED" && newStatus !== "PUBLISHED") return [];

  const targets = await prisma.distributionTarget.findMany({
    where: { active: true, publishMode: "AUTO", autoPublishOn: newStatus },
  });

  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } });
  if (!draft) return [];

  const projectTargets = targets.filter(t => t.projectId === draft.projectId);
  const results = [];

  for (const target of projectTargets) {
    const result = await distributeToTarget({ draftId, targetId: target.id });
    results.push({ targetId: target.id, targetName: target.name, ...result });
  }

  return results;
}

// 手动分发单个目标（保留兼容）
export async function triggerManualDistribution(draftId: string, targetId: string) {
  return distributeToTarget({ draftId, targetId });
}

// 批量分发（保留兼容）
export async function triggerBatchDistribution(draftId: string, targetIds?: string[]) {
  const draft = await prisma.contentDraft.findUnique({
    where: { id: draftId },
    include: {
      project: {
        include: {
          distributionTargets: {
            where: { active: true, ...(targetIds && { id: { in: targetIds } }) },
          },
        },
      },
    },
  });

  if (!draft) throw new Error("草稿不存在");

  const results = [];
  for (const target of draft.project.distributionTargets) {
    const result = await distributeToTarget({ draftId, targetId: target.id });
    results.push({ targetId: target.id, targetName: target.name, ...result });
  }

  return results;
}

export { getDistributionHistory } from "@/lib/distribution";
