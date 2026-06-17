// 草稿版本历史。
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

    const revisions = await prisma.contentRevision.findMany({
      where: { draftId: params.id },
      orderBy: { version: "desc" },
    });

    return success(revisions);
  } catch (err) {
    return handleError(err);
  }
}
