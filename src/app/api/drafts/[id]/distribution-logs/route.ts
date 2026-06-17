// 草稿分发历史。
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
    const draft = await prisma.contentDraft.findUnique({ where: { id: params.id } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    const logs = await prisma.distributionLog.findMany({
      where: { draftId: draft.id },
      orderBy: { createdAt: "desc" },
      include: { target: { select: { name: true, platform: true } } },
    });

    return success(logs);
  } catch (err) {
    return handleError(err);
  }
}
