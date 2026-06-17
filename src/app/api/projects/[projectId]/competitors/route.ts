// 竞品列表 + 创建。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { createCompetitorSchema } from "@/lib/api/validators/geo";
import { Errors, handleError, success, created } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const competitors = await prisma.competitor.findMany({
      where: { projectId: params.projectId },
      orderBy: { name: "asc" },
    });

    return success(competitors);
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
    const parsed = createCompetitorSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const competitor = await prisma.competitor.create({
      data: {
        ...parsed.data,
        projectId: params.projectId,
      },
    });

    await audit("COMPETITOR_CREATE", {
      userId: session.user.id,
      targetType: "Competitor",
      targetId: competitor.id,
      metadata: { projectId: params.projectId, name: competitor.name },
    });

    return created(competitor);
  } catch (err) {
    return handleError(err);
  }
}
