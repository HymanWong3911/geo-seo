// 分发服务
import { prisma } from "@/lib/db";
import type { DistributionPlatform } from "./platforms";
import { getAdapter, type DistributionInput, type DistributionResult } from "./adapters";

interface DistributeOptions {
  draftId: string;
  targetId: string;
  override?: {
    title?: string;
    content?: string;
    excerpt?: string;
  };
}

// 手动分发单目标
export async function distributeToTarget(options: DistributeOptions): Promise<DistributionResult> {
  const target = await prisma.distributionTarget.findUnique({ where: { id: options.targetId } });
  
  if (!target || !target.active) {
    return { success: false, error: "目标不存在或已停用" };
  }

  const draft = await prisma.contentDraft.findUnique({ where: { id: options.draftId } });
  if (!draft) return { success: false, error: "草稿不存在" };

  const adapter = getAdapter(target.platform as DistributionPlatform);
  if (!adapter) return { success: false, error: `不支持的平台: ${target.platform}` };

  const config = (target.config as Record<string, unknown>) || {};
  const validation = adapter.validateConfig(config);
  if (!validation.valid) {
    // 失败也要写 log，便于历史追溯
    await prisma.distributionLog.create({
      data: {
        targetId: target.id,
        draftId: draft.id,
        status: "FAILED",
        errorMessage: `配置缺失: ${validation.missing.join(", ")}`,
        attempts: 1,
        sentAt: null,
      },
    });
    return { success: false, error: `配置缺失: ${validation.missing.join(", ")}` };
  }

  const input: DistributionInput = {
    title: options.override?.title ?? draft.title,
    content: options.override?.content ?? draft.content,
    excerpt: options.override?.excerpt ?? draft.excerpt ?? undefined,
    url: draft.slug ? `/${draft.slug}` : undefined,
    author: draft.authorId ?? undefined,
  };

  const result = await adapter.distribute(config, input);

  await prisma.distributionLog.create({
    data: {
      targetId: target.id,
      draftId: draft.id,
      status: result.success ? "SUCCESS" : "FAILED",
      externalId: result.externalId ?? null,
      externalUrl: result.externalUrl ?? null,
      errorMessage: result.error ?? null,
      attempts: 1,
      sentAt: result.success ? new Date() : null,
    },
  });

  return result;
}

// 获取分发历史
export async function getDistributionHistory(draftId?: string, targetId?: string, limit = 50) {
  return prisma.distributionLog.findMany({
    where: { ...(draftId && { draftId }), ...(targetId && { targetId }) },
    include: { target: { select: { name: true, platform: true } }, draft: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
