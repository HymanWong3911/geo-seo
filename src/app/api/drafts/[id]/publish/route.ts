import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireProjectEditor, requireSession } from "@/lib/api/auth";
import { enqueueCmsPublish } from "@/lib/queue/cms";
import { Errors, handleError, success } from "@/lib/api/response";

const schema = z.object({ integrationId: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw Errors.badRequest("参数错误", parsed.error.flatten());

    const [draft, integration] = await Promise.all([
      prisma.contentDraft.findUnique({
        where: { id: params.id },
        include: { publishLog: { select: { status: true } } },
      }),
      prisma.cmsIntegration.findUnique({ where: { id: parsed.data.integrationId } }),
    ]);
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);
    if (draft.status !== "APPROVED") {
      throw Errors.conflict("只有审核通过的草稿才能发布");
    }
    if (!integration || integration.projectId !== draft.projectId) {
      throw Errors.notFound("CMS 集成");
    }
    if (!integration.active) throw Errors.conflict("CMS 集成已停用");
    if (draft.publishLog?.status === "PENDING" || draft.publishLog?.status === "RUNNING") {
      throw Errors.conflict("该草稿已有发布任务正在执行");
    }
    if (draft.publishLog?.status === "SUCCESS") {
      throw Errors.conflict("该草稿已经发布");
    }

    const job = await enqueueCmsPublish({
      draftId: draft.id,
      integrationId: integration.id,
      userId: session.user.id,
    });

    return success({ jobId: String(job.id), status: "QUEUED" }, undefined, 202);
  } catch (err) {
    return handleError(err);
  }
}
