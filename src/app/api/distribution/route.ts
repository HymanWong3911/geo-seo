import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectEditor, requireSession } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";
import { triggerManualDistribution, triggerBatchDistribution, validateTargetConfig } from "@/workers/distributionWorker";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { draftId, targetId, targetIds, action } = body;

    if (!draftId) {
      return NextResponse.json({ error: { message: "缺少 draftId" } }, { status: 400 });
    }

    const draft = await prisma.contentDraft.findUnique({
      where: { id: draftId },
      select: { projectId: true },
    });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    let result;

    switch (action) {
      case "batch":
        if (!Array.isArray(targetIds) || targetIds.length === 0 || !targetIds.every((id) => typeof id === "string")) {
          return NextResponse.json({ error: { message: "缺少 targetIds" } }, { status: 400 });
        }
        {
          const matchedTargets = await prisma.distributionTarget.count({
            where: { id: { in: targetIds }, projectId: draft.projectId, active: true },
          });
          if (matchedTargets !== new Set(targetIds).size) {
            throw Errors.badRequest("分发目标不存在、已停用或不属于草稿项目");
          }
        }
        result = await triggerBatchDistribution(draftId, targetIds);
        break;
      
      case "single":
        if (!targetId) {
          return NextResponse.json({ error: { message: "缺少 targetId" } }, { status: 400 });
        }
        {
          const target = await prisma.distributionTarget.findFirst({
            where: { id: targetId, projectId: draft.projectId, active: true },
            select: { id: true },
          });
          if (!target) throw Errors.badRequest("分发目标不存在、已停用或不属于草稿项目");
        }
        result = await triggerManualDistribution(draftId, targetId);
        break;
      
      default:
        return NextResponse.json({ error: { message: "未知操作" } }, { status: 400 });
    }

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const targetId = url.searchParams.get("targetId");

    if (!targetId) {
      return NextResponse.json({ error: { message: "缺少 targetId" } }, { status: 400 });
    }

    const target = await prisma.distributionTarget.findUnique({
      where: { id: targetId },
      select: { projectId: true },
    });
    if (!target) throw Errors.notFound("分发目标");
    await requireProjectEditor(session.user.id, session.user.role, target.projectId);

    const result = await validateTargetConfig(targetId);
    return success(result);
  } catch (err) {
    return handleError(err);
  }
}
