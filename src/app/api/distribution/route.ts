import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { triggerManualDistribution, triggerBatchDistribution, validateTargetConfig } from "@/workers/distributionWorker";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { draftId, targetId, targetIds, action } = body;

    if (!draftId) {
      return NextResponse.json({ error: { message: "缺少 draftId" } }, { status: 400 });
    }

    let result;

    switch (action) {
      case "batch":
        if (!targetIds) {
          return NextResponse.json({ error: { message: "缺少 targetIds" } }, { status: 400 });
        }
        result = await triggerBatchDistribution(draftId, targetIds);
        break;
      
      case "single":
        if (!targetId) {
          return NextResponse.json({ error: { message: "缺少 targetId" } }, { status: 400 });
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

    const result = await validateTargetConfig(targetId);
    return success(result);
  } catch (err) {
    return handleError(err);
  }
}
