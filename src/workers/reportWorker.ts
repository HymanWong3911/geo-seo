// BullMQ worker: report-generation
// 调 lib/reports/generator 生成 Markdown 报告 + 写 Report 表。
// 详细说明见 dev doc v1.2 18.8 节。

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/logger";
import { generateReport, type ReportType } from "@/lib/reports/generator";

export interface ReportJob {
  projectId: string;
  type: ReportType;
  userId?: string;
  auditId?: string;
}

export async function generateReportJob(job: ReportJob): Promise<{ reportId: string }> {
  const { projectId, type, userId, auditId } = job;

  const now = new Date();
  const periodTo = now;
  let periodFrom: Date;
  let fromDays: number;
  switch (type) {
    case "WEEKLY":
      fromDays = 7;
      periodFrom = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      break;
    case "MONTHLY":
      fromDays = 30;
      periodFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      break;
    case "AUDIT":
      fromDays = 1;
      periodFrom = new Date(now.getTime() - 24 * 3600 * 1000);
      break;
  }

  const content = await generateReport({
    projectId,
    type,
    fromDays,
    auditId,
  });

  const report = await prisma.report.create({
    data: {
      projectId,
      type,
      periodFrom,
      periodTo,
      auditId: auditId ?? null,
      content,
      generatedBy: userId ?? null,
    },
  });

  await audit("REPORT_EXPORT", {
    userId,
    targetType: "Report",
    targetId: report.id,
    metadata: { type, projectId },
  });

  return { reportId: report.id };
}

export const reportWorker = new Worker<ReportJob>(
  "report-generation",
  async (job) => generateReportJob(job.data),
  { connection, concurrency: 2 },
);
