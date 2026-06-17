import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { distributeToTarget } from "@/lib/distribution";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const log = await prisma.distributionLog.findUnique({
      where: { id: params.id },
      include: { target: { select: { projectId: true } } },
    });
    if (!log) throw Errors.notFound("分发日志");
    await requireProjectEditor(session.user.id, session.user.role, log.target.projectId);

    if (log.status !== "FAILED" && log.status !== "PENDING") {
      throw Errors.badRequest(`日志状态 ${log.status}，只有 FAILED/PENDING 可重试`);
    }

    if (!log.draftId) throw Errors.badRequest("分发日志缺少 draftId");

    const result = await distributeToTarget({ draftId: log.draftId, targetId: log.targetId });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "DistributionLog",
      targetId: log.id,
      metadata: { success: result.success },
    });

    return success({
      logId: log.id,
      success: result.success,
      externalUrl: result.externalUrl,
      error: result.error,
    });
  } catch (err) {
    return handleError(err);
  }
}
