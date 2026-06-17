import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";
import { triggerBatchDistribution, getDistributionHistory } from "@/workers/distributionWorker";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const includeStats = url.searchParams.get("includeStats") === "true";
    const draftId = url.searchParams.get("draftId");

    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    if (draftId) {
      // 获取特定草稿的分发历史
      const logs = await getDistributionHistory(draftId);
      return success(logs);
    }

    const targets = await prisma.distributionTarget.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { logs: true } },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // 格式化返回
    const result = targets.map(t => ({
      ...t,
      lastLog: t.logs[0] || null,
      logs: undefined,
    }));

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const { name, platform, config, publishMode = "MANUAL", autoPublishOn = "APPROVED" } = body;

    if (!name || !platform) {
      return NextResponse.json({ error: { message: "缺少必填字段" } }, { status: 400 });
    }

    const target = await prisma.distributionTarget.create({
      data: {
        projectId: params.projectId,
        name,
        platform,
        config: config || {},
        publishMode,
        autoPublishOn,
        active: true,
      },
    });

    return success(target);
  } catch (err) {
    return handleError(err);
  }
}
