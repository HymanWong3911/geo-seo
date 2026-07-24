// 批量触发 GEO runs(同时给多个项目发)。
// 用法:POST /api/geo/runs/bulk  body: { projectIds: string[] }
// 或:  POST /api/projects/{p}/geo/runs/bulk  body: { count?: number }
// 投资人 demo:一次性起 5 个项目的 GEO monitoring。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { enqueueGeoRun } from "@/lib/queue/geo";
import { Errors, handleError, success } from "@/lib/api/response";

// POST /api/geo/runs/bulk - 一次性给多个项目触发(跨项目)
const bulkSchema = z.object({
  projectIds: z.array(z.string()).min(1).max(50),
  triggerType: z.enum(["MANUAL", "SCHEDULED", "RETRY"]).default("MANUAL"),
});

// POST /api/projects/{p}/geo/runs/bulk - 单项目批量触发多个(用 count)
const projectBulkSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(1),
  triggerType: z.enum(["MANUAL", "SCHEDULED", "RETRY"]).default("MANUAL"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId?: string } },
) {
  try {
    const session = await requireSession();

    if (params.projectId) {
      // 单项目批量
      await requireProjectEditor(session.user.id, session.user.role, params.projectId);
      const body = await req.json();
      const parsed = projectBulkSchema.safeParse(body);
      if (!parsed.success) {
        throw Errors.badRequest("参数错误", parsed.error.flatten());
      }
      const jobs: Array<{ jobId: string; projectId: string }> = [];
      for (let i = 0; i < parsed.data.count; i++) {
        const job = await enqueueGeoRun({
          projectId: params.projectId,
          userId: session.user.id,
          triggerType: parsed.data.triggerType,
        });
        // BullMQ 类型 job.id 是 string | undefined,这里强转字符串
        jobs.push({ jobId: String(job.id ?? ""), projectId: params.projectId });
      }
      await audit("GEO_RUN_TRIGGER", {
        userId: session.user.id,
        targetType: "Project",
        targetId: params.projectId,
        metadata: { kind: "bulk", count: parsed.data.count, triggerType: parsed.data.triggerType },
      });
      return success({
        kind: "single-project-bulk",
        projectId: params.projectId,
        jobs,
        count: jobs.length,
      });
    }

    // 跨项目批量
    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 验证每个 projectId 当前用户有权限
    const results: Array<{ projectId: string; jobId: string | null; error?: string }> = [];
    for (const projectId of parsed.data.projectIds) {
      try {
        await requireProjectEditor(session.user.id, session.user.role, projectId);
        const job = await enqueueGeoRun({
          projectId,
          userId: session.user.id,
          triggerType: parsed.data.triggerType,
        });
        // BullMQ 实际总会给 job.id(redis 写入后才有),但类型上是 string | undefined,这里强转
        results.push({ projectId, jobId: String(job.id ?? "") });
      } catch (err) {
        results.push({
          projectId,
          jobId: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await audit("GEO_RUN_TRIGGER", {
      userId: session.user.id,
      targetType: "Project",
      metadata: {
        kind: "cross-project-bulk",
        count: parsed.data.projectIds.length,
        triggerType: parsed.data.triggerType,
      },
    });

    return success({
      kind: "cross-project-bulk",
      jobs: results,
      requested: parsed.data.projectIds.length,
      queued: results.filter((r) => r.jobId !== null).length,
      skipped: results.filter((r) => r.error).length,
    });
  } catch (err) {
    return handleError(err);
  }
}
