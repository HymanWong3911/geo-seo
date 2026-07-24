// 跨项目批量触发 GEO runs(无 projectId 路径)。
// POST /api/geo/runs/bulk body: { projectIds: [...], triggerType?: "MANUAL" }
// 2026-07-23:复用上面 [projectId]/geo/runs/bulk 的逻辑(没 projectId 路径)。
import { NextRequest } from "next/server";
import { handleError, success } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { enqueueGeoRun } from "@/lib/queue/geo";

export async function POST(_req: NextRequest) {
  try {
    const session = await requireSession();
    // 默认行为:对当前用户可见的所有项目触发一次
    const projectIds = await listUserProjectIds(session.user.id, session.user.role);
    if (projectIds.length === 0) {
      return success({ kind: "all-projects-bulk", queued: 0, jobs: [] });
    }
    const jobs: Array<{ projectId: string; jobId: string }> = [];
    for (const projectId of projectIds) {
      const job = await enqueueGeoRun({
        projectId,
        userId: session.user.id,
        triggerType: "MANUAL",
      });
      jobs.push({ projectId, jobId: String(job.id ?? "") });
    }
    await audit("GEO_RUN_TRIGGER", {
      userId: session.user.id,
      targetType: "Project",
      metadata: { kind: "all-visible-projects", count: projectIds.length },
    });
    return success({ kind: "all-projects-bulk", queued: jobs.length, jobs });
  } catch (err) {
    return handleError(err);
  }
}
