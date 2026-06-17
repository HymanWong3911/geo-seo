// 页面审计 worker。
// 详细说明见 dev doc v1.2 M2 节。
// 流程：
//   1. 从 page-audit 队列取任务
//   2. 调用 crawler 抓取页面
//   3. 调用 SEO analyzer
//   4. 写 Page + PageAudit
//   5. 写审计日志

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { crawlPage } from "@/lib/crawler";
import { analyzeSeo, type Finding, type PerformanceData } from "@/lib/seo/analyzer";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/logger";
import type { PageAuditJob } from "@/lib/queue/audit";
import { Prisma } from "@prisma/client";

export const pageAuditWorker = new Worker<PageAuditJob>(
  "page-audit",
  async (job) => {
    const { projectId, url, userId, triggerType } = job.data;

    // 1. 抓取
    const crawl = await crawlPage(url);

    // 2. 分析
    const analysis = analyzeSeo({
      url: crawl.url,
      finalUrl: crawl.finalUrl,
      statusCode: crawl.statusCode,
      html: crawl.html,
      performance: crawl.performance,
    });

    // 3. 写 Page（upsert）
    const page = await prisma.page.upsert({
      where: { projectId_url: { projectId, url: crawl.finalUrl } },
      update: {
        title: analysis.snapshot.title,
        description: analysis.snapshot.description,
        h1: analysis.snapshot.h1,
        wordCount: analysis.snapshot.wordCount,
        lastCrawledAt: new Date(),
      },
      create: {
        projectId,
        url: crawl.finalUrl,
        title: analysis.snapshot.title,
        description: analysis.snapshot.description,
        h1: analysis.snapshot.h1,
        wordCount: analysis.snapshot.wordCount,
        lastCrawledAt: new Date(),
      },
    });

    // 4. 写 PageAudit
    const pageAudit = await prisma.pageAudit.create({
      data: {
        pageId: page.id,
        score: analysis.score,
        statusCode: crawl.statusCode,
        indexable: analysis.indexable,
        findings: analysis.findings as unknown as Prisma.InputJsonValue,
        rawSnapshot: {
          ...analysis.snapshot,
          crawlMethod: crawl.method,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 5. 审计日志
    await audit("PAGE_AUDIT_TRIGGER", {
      userId,
      targetType: "Page",
      targetId: page.id,
      metadata: {
        projectId,
        url: crawl.finalUrl,
        statusCode: crawl.statusCode,
        score: analysis.score,
        findingsCount: analysis.findings.length,
        triggerType,
        crawlMethod: crawl.method,
      },
    });

    return {
      auditId: pageAudit.id,
      pageId: page.id,
      score: analysis.score,
      findingsCount: analysis.findings.length,
    };
  },
  { connection, concurrency: 5 },
);

// 同步执行（开发模式 / 单次审计）
export async function runPageAuditSync(
  job: PageAuditJob,
): Promise<{ auditId: string; pageId: string; score: number; findingsCount: number; findings: Finding[] }> {
  const { projectId, url, userId, triggerType } = job;
  const crawl = await crawlPage(url);
  const analysis = analyzeSeo({
    url: crawl.url,
    finalUrl: crawl.finalUrl,
    statusCode: crawl.statusCode,
    html: crawl.html,
    performance: crawl.performance,
  });
  const page = await prisma.page.upsert({
    where: { projectId_url: { projectId, url: crawl.finalUrl } },
    update: {
      title: analysis.snapshot.title,
      description: analysis.snapshot.description,
      h1: analysis.snapshot.h1,
      wordCount: analysis.snapshot.wordCount,
      lastCrawledAt: new Date(),
    },
    create: {
      projectId,
      url: crawl.finalUrl,
      title: analysis.snapshot.title,
      description: analysis.snapshot.description,
      h1: analysis.snapshot.h1,
      wordCount: analysis.snapshot.wordCount,
      lastCrawledAt: new Date(),
    },
  });
  const pageAudit = await prisma.pageAudit.create({
    data: {
      pageId: page.id,
      score: analysis.score,
      statusCode: crawl.statusCode,
      indexable: analysis.indexable,
      findings: analysis.findings as unknown as Prisma.InputJsonValue,
      rawSnapshot: { ...analysis.snapshot, crawlMethod: crawl.method } as unknown as Prisma.InputJsonValue,
    },
  });
  await audit("PAGE_AUDIT_TRIGGER", {
    userId,
    targetType: "Page",
    targetId: page.id,
    metadata: {
      projectId, url: crawl.finalUrl, statusCode: crawl.statusCode,
      score: analysis.score, findingsCount: analysis.findings.length,
      triggerType, crawlMethod: crawl.method, sync: true,
    },
  });
  return {
    auditId: pageAudit.id,
    pageId: page.id,
    score: analysis.score,
    findingsCount: analysis.findings.length,
    findings: analysis.findings,
  };
}
