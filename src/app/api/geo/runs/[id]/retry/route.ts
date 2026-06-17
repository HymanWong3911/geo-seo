// 重试失败的 GEO run。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { runGeoRunSync } from "@/workers/geoRunWorker";
import { enqueueGeoRun } from "@/lib/queue/geo";
import { Errors, handleError, created } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const run = await prisma.geoRun.findUnique({ where: { id: params.id } });
    if (!run) throw Errors.notFound("GEO run");

    await requireProjectEditor(session.user.id, session.user.role, run.projectId);

    const url = new URL(req.url);
    const sync = url.searchParams.get("sync") === "true";

    const questionIds = run.questionIds.length > 0 ? run.questionIds : undefined;

    if (sync) {
      const result = await runGeoRunSync({
        projectId: run.projectId,
        questionIds,
        userId: session.user.id,
        triggerType: "MANUAL",
      });
      return created(result);
    }

    const job = await enqueueGeoRun({
      projectId: run.projectId,
      questionIds,
      userId: session.user.id,
      triggerType: "RETRY" as const,
    });
    return created({ jobId: job.id, status: "PENDING" });
  } catch (err) {
    return handleError(err);
  }
}
