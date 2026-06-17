// Retention worker。
// 详细说明见 dev doc v1.2 18.9 + 27 节。
// 每月 1 日 03:00 跑。
// - 删除 12 个月前 PageAudit / GeoRunResult / LlmCall
// - 导出 + 删除 6 个月前 AuditLog
// - 归档 12 个月未活跃项目

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { SchedulerJob } from "@/lib/queue/scheduler";

const RETENTION_DIR = process.env.RETENTION_EXPORT_DIR ?? "./backups/retention";

async function runRetentionCleanup() {
  console.log("[retention] starting cleanup...");
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 12);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  mkdirSync(RETENTION_DIR, { recursive: true });

  // 1. 12 个月前的 PageAudit
  const pageAuditDeleted = await prisma.pageAudit.deleteMany({
    where: { createdAt: { lt: monthAgo } },
  });
  console.log(`[retention] deleted ${pageAuditDeleted.count} PageAudit`);

  // 2. 12 个月前的 GeoRunResult
  // 关联 GeoRun（先删 result，再考虑是否删 run）
  const oldRuns = await prisma.geoRun.findMany({
    where: { createdAt: { lt: monthAgo } },
    select: { id: true },
  });
  const geoResultDeleted = await prisma.geoRunResult.deleteMany({
    where: { geoRunId: { in: oldRuns.map((r) => r.id) } },
  });
  console.log(`[retention] deleted ${geoResultDeleted.count} GeoRunResult`);

  const geoRunDeleted = await prisma.geoRun.deleteMany({
    where: { id: { in: oldRuns.map((r) => r.id) } },
  });
  console.log(`[retention] deleted ${geoRunDeleted.count} GeoRun`);

  // 3. 12 个月前的 LlmCall
  const llmCallDeleted = await prisma.llmCall.deleteMany({
    where: { createdAt: { lt: monthAgo } },
  });
  console.log(`[retention] deleted ${llmCallDeleted.count} LlmCall`);

  // 4. 6 个月前的 AuditLog → 导出 + 删除
  const oldLogs = await prisma.auditLog.findMany({
    where: { createdAt: { lt: sixMonthsAgo } },
    include: { user: { select: { email: true } } },
  });

  if (oldLogs.length > 0) {
    const csv = [
      "id,user,action,targetType,targetId,ip,userAgent,metadata,createdAt",
      ...oldLogs.map((l) => [
        l.id,
        l.user?.email ?? "",
        l.action,
        l.targetType ?? "",
        l.targetId ?? "",
        l.ip ?? "",
        l.userAgent ?? "",
        JSON.stringify(l.metadata ?? {}).replace(/"/g, '""'),
        l.createdAt.toISOString(),
      ].map((v) => {
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(",")),
    ].join("\n");
    const filename = join(RETENTION_DIR, `audit-log-${now.toISOString().slice(0, 7)}.csv`);
    writeFileSync(filename, csv);
    console.log(`[retention] exported ${oldLogs.length} AuditLog to ${filename}`);

    const auditDeleted = await prisma.auditLog.deleteMany({
      where: { id: { in: oldLogs.map((l) => l.id) } },
    });
    console.log(`[retention] deleted ${auditDeleted.count} AuditLog`);
  }

  // 5. 12 个月未活跃项目（archived 且 archivedAt 超过 12 个月）→ 硬删
  // v1.2 暂不硬删业务数据（v1.1 doc 27.4 说"归档不删"）
  // 仅打印预警
  const oldArchived = await prisma.project.findMany({
    where: {
      status: "ARCHIVED",
      archivedAt: { lt: monthAgo },
    },
    select: { id: true, name: true, archivedAt: true },
  });
  if (oldArchived.length > 0) {
    console.warn(
      `[retention] ${oldArchived.length} 个项目归档超过 12 个月，建议人工确认是否硬删:`,
    );
    for (const p of oldArchived) {
      console.warn(`  - ${p.name} (${p.id}, archived ${p.archivedAt?.toISOString().slice(0, 10)})`);
    }
  }

  console.log("[retention] cleanup done");
}

export const retentionWorker = new Worker<SchedulerJob>(
  "scheduler",
  async (job) => {
    if (job.data.type === "retention-cleanup") {
      await runRetentionCleanup();
    }
  },
  { connection, concurrency: 1 },
);
