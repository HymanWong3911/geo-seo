// CMS 发布 worker。
// 详细说明见 dev doc v1.2 M9 节。
// 流程：
//   1. 读草稿 + 关联的 CmsIntegration
//   2. 调 cmsAdapter.createArticle（带重试 5 次）
//   3. 写 PublishLog（含 externalId / externalUrl）
//   4. 失败 → 告警

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/logger";
import { cmsAdapter, type ArticleResult } from "@/lib/cms";
import { sendAlert } from "@/lib/alert/sender";
import { JobStatus } from "@prisma/client";
import type { SchedulerJob } from "@/lib/queue/scheduler";

// 模拟 BullMQ 任务类型（cms-publish 队列）
export interface CmsPublishJob {
  draftId: string;
  integrationId: string;
  userId: string;
}

const BACKOFF_MS = [5_000, 30_000, 60_000, 120_000, 240_000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function publishDraft(job: CmsPublishJob): Promise<{
  success: boolean;
  publishLogId: string;
  externalUrl?: string;
  error?: string;
}> {
  const { draftId, integrationId, userId } = job;

  const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("草稿不存在");

  const integration = await prisma.cmsIntegration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new Error("CMS 集成不存在");
  if (!integration.active) throw new Error("CMS 集成已停用");

  // 创建 publishLog（PENDING）
  const publishLog = await prisma.publishLog.create({
    data: {
      draftId: draft.id,
      cmsIntegrationId: integration.id,
      status: JobStatus.PENDING,
      attempts: 0,
    },
  });

  // 5 次重试
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const result: ArticleResult = await cmsAdapter.createArticle({
        title: draft.title,
        content: draft.content,
        excerpt: draft.excerpt ?? undefined,
        status: "published",
        metaTitle: draft.metaTitle ?? undefined,
        metaDescription: draft.metaDescription ?? undefined,
      });

      await prisma.publishLog.update({
        where: { id: publishLog.id },
        data: {
          status: "SUCCESS",
          attempts: attempt,
          externalId: result.id,
          externalUrl: result.url,
          publishedAt: new Date(),
        },
      });

      // 草稿置为已发布
      await prisma.contentDraft.update({
        where: { id: draft.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });

      await audit("REPORT_EXPORT", {
        userId,
        targetType: "PublishLog",
        targetId: publishLog.id,
        metadata: { action: "publish", draftId, integrationId, externalUrl: result.url },
      });

      return { success: true, publishLogId: publishLog.id, externalUrl: result.url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[cms-publish] attempt ${attempt} failed:`, lastError);

      await prisma.publishLog.update({
        where: { id: publishLog.id },
        data: { attempts: attempt, errorMessage: lastError },
      });

      if (attempt < 5) {
        await sleep(BACKOFF_MS[attempt - 1]);
      }
    }
  }

  // 5 次全失败
  await prisma.publishLog.update({
    where: { id: publishLog.id },
    data: { status: "FAILED" },
  });

  await sendAlert({
    eventType: "ANOMALY_DETECTED",
    payload: {
      title: "【CMS 发布失败】",
      草稿: draft.title,
      CMS集成: integration.name,
      错误: lastError ?? "未知",
    },
  });

  return { success: false, publishLogId: publishLog.id, error: lastError };
}

// Rollback：删除已发布的文章
export async function rollbackPublish(publishLogId: string, reason: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const log = await prisma.publishLog.findUnique({ where: { id: publishLogId } });
  if (!log) throw new Error("PublishLog 不存在");
  if (!log.externalId) throw new Error("没有 externalId，无法撤销");

  try {
    await cmsAdapter.deleteArticle(log.externalId);
    await prisma.publishLog.update({
      where: { id: log.id },
      data: { rolledBackAt: new Date(), rollbackReason: reason },
    });
    // 草稿回到 APPROVED
    await prisma.contentDraft.update({
      where: { id: log.draftId },
      data: { status: "APPROVED", publishedAt: null },
    });
    await audit("DATA_DELETE", {
      userId,
      targetType: "PublishLog",
      targetId: log.id,
      metadata: { action: "rollback", reason },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// 简单的 worker 集成（BullMQ 注册到 scheduler 队列）
export const cmsPublisherWorker = new Worker<SchedulerJob | CmsPublishJob>(
  "cms-publish",
  async (job) => {
    if ("draftId" in job.data && "integrationId" in job.data) {
      return publishDraft(job.data as CmsPublishJob);
    }
  },
  { connection, concurrency: 2 },
);
