// 取消归档。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectOwner } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectOwner(session.user.id, session.user.role, params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });
    if (!project) throw Errors.notFound("项目");

    if (project.status !== "ARCHIVED") {
      throw Errors.conflict("项目未归档");
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "ACTIVE", archivedAt: null },
    });

    await audit("PROJECT_UPDATE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: project.id,
      metadata: { unarchive: true },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
