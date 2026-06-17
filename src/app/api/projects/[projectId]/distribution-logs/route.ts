import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const targetId = url.searchParams.get("targetId");
    const limit = parseInt(url.searchParams.get("limit") ?? "100");

    // 获取该项目的所有分发目标
    const targets = await prisma.distributionTarget.findMany({
      where: { projectId: params.projectId },
      select: { id: true },
    });
    const targetIds = targets.map(t => t.id);

    if (targetIds.length === 0) {
      return success([]);
    }

    const logs = await prisma.distributionLog.findMany({
      where: {
        targetId: { in: targetIds },
        ...(status && { status: status as "SUCCESS" | "FAILED" | "PENDING" }),
        ...(targetId && { targetId }),
      },
      include: {
        target: { select: { name: true, platform: true } },
        draft: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return success(logs);
  } catch (err) {
    return handleError(err);
  }
}
