// 归档项目。
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

    if (project.status === "ARCHIVED") {
      throw Errors.conflict("项目已归档");
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    await audit("PROJECT_ARCHIVE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: project.id,
      metadata: { name: project.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
