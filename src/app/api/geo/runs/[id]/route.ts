// 单个 GEO 运行详情。
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
    const run = await prisma.geoRun.findUnique({
      where: { id: params.id },
      include: {
        results: {
          orderBy: { createdAt: "asc" },
          include: { geoQuestion: { select: { id: true, question: true } } },
        },
        project: { select: { id: true, name: true, primaryBrand: true } },
      },
    });
    if (!run) throw Errors.notFound("GEO run");

    await requireProjectEditor(session.user.id, session.user.role, run.projectId);

    return success(run);
  } catch (err) {
    return handleError(err);
  }
}
