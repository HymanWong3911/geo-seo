// BullMQ worker: content-analysis
// 调 lib/content/analyzer 给已发布内容打 SEO/GEO 建议 + 批量生成任务。
// 详细说明见 dev doc v1.2 12 节。

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/logger";
import { analyzeContent, type ContentAnalysisInput } from "@/lib/content/analyzer";
import { TaskStatus, TaskSource } from "@prisma/client";

export interface ContentAnalysisJob {
  projectId: string;
  brandName: string;
  url?: string;
  content?: string;
  contentFormat?: "html" | "text";
  targetKeywords?: string[];
  geoQuestionIds?: string[];
  userId?: string;
  generateTasks?: boolean;
}

const AUTO_TASK_THRESHOLD = 3;

export async function runContentAnalysis(job: ContentAnalysisJob): Promise<{
  result: Awaited<ReturnType<typeof analyzeContent>>;
  tasksCreated: number;
}> {
  const input: ContentAnalysisInput = {
    projectId: job.projectId,
    brandName: job.brandName,
    url: job.url,
    content: job.content,
    contentFormat: job.contentFormat,
    targetKeywords: job.targetKeywords ?? [],
    geoQuestionIds: job.geoQuestionIds,
  };

  const result = await analyzeContent(input);

  let tasksCreated = 0;
  if (job.generateTasks !== false) {
    const taskInputs: Array<{ title: string; priority: number }> = [];
    for (const sug of result.seoSuggestions.keywordGaps) {
      taskInputs.push({ title: `补充关键词 "${sug}" 到内容`, priority: 2 });
    }
    for (const sug of result.seoSuggestions.headingSuggestions.slice(0, 3)) {
      taskInputs.push({ title: `优化标题：${sug.slice(0, 80)}`, priority: 3 });
    }
    for (const sug of result.seoSuggestions.internalLinkSuggestions) {
      taskInputs.push({ title: `添加内链：${sug.slice(0, 80)}`, priority: 3 });
    }
    for (const sug of result.geoSuggestions.citableSnippets.slice(0, 2)) {
      taskInputs.push({ title: `GEO 引用：${sug.slice(0, 60)}`, priority: 2 });
    }

    if (taskInputs.length >= AUTO_TASK_THRESHOLD) {
      await prisma.optimizationTask.createMany({
        data: taskInputs.map((t) => ({
          projectId: job.projectId,
          title: t.title,
          sourceType: TaskSource.CONTENT_ANALYSIS,
          sourceId: job.url ?? `content-${Date.now()}`,
          url: job.url ?? null,
          priority: t.priority,
          status: TaskStatus.TODO,
        })),
      });
      tasksCreated = taskInputs.length;
    }
  }

  await audit("CONTENT_ANALYSIS_TRIGGER", {
    userId: job.userId,
    targetType: "ContentAnalysis",
    targetId: job.url ?? `content-${Date.now()}`,
    metadata: {
      projectId: job.projectId,
      tasksCreated,
      seoIssues: result.seoSuggestions.keywordGaps.length,
    },
  });

  return { result, tasksCreated };
}

export const contentAnalysisWorker = new Worker<ContentAnalysisJob>(
  "content-analysis",
  async (job) => runContentAnalysis(job.data),
  { connection, concurrency: 3 },
);
