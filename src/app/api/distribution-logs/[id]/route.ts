import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const log = await prisma.distributionLog.findUnique({
      where: { id: params.id },
      include: {
        target: { select: { name: true, platform: true, projectId: true } },
        draft: { select: { title: true } },
      },
    });
    if (!log) throw Errors.notFound("分发日志");
    await requireProjectEditor(session.user.id, session.user.role, log.target.projectId);
    return success(log);
  } catch (err) {
    return handleError(err);
  }
}
