// 撤销发布。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { rollbackPublish } from "@/workers/cmsPublisherWorker";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({
  reason: z.string().min(1, "请填写撤销原因"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const log = await prisma.publishLog.findUnique({ where: { id: params.id } });
    if (!log) throw Errors.notFound("PublishLog");
    const draft = await prisma.contentDraft.findUnique({ where: { id: log.draftId } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const result = await rollbackPublish(params.id, parsed.data.reason, session.user.id);
    if (!result.success) {
      throw Errors.badRequest(result.error ?? "撤销失败");
    }

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
