import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { generateProjectInsights, invalidateProjectInsights } from "@/lib/insights/generator";
import { Errors, handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  refresh: z.enum(["0", "1"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    if (!project) throw Errors.notFound("项目");

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      refresh: url.searchParams.get("refresh") ?? undefined,
    });
    if (!parsed.success) throw Errors.badRequest("参数错误", parsed.error.flatten());

    const insights = await generateProjectInsights(params.projectId, {
      forceRefresh: parsed.data.refresh === "1",
    });
    return success(insights);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);
    await invalidateProjectInsights(params.projectId);
    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "Project",
      targetId: params.projectId,
      metadata: { action: "insights-cache-invalidated" },
    });
    return success({ invalidated: true });
  } catch (err) {
    return handleError(err);
  }
}
