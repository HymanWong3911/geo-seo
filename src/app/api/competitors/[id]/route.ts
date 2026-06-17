// 单个竞品更新 / 删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateCompetitorSchema } from "@/lib/api/validators/geo";
import { Errors, handleError, success } from "@/lib/api/response";

async function loadC(id: string) {
  const c = await prisma.competitor.findUnique({ where: { id } });
  if (!c) throw Errors.notFound("竞品");
  return c;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const c = await loadC(params.id);
    await requireProjectEditor(session.user.id, session.user.role, c.projectId);

    const body = await req.json();
    const parsed = updateCompetitorSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.competitor.update({
      where: { id: c.id },
      data: parsed.data,
    });

    await audit("COMPETITOR_UPDATE", {
      userId: session.user.id,
      targetType: "Competitor",
      targetId: c.id,
      metadata: { changes: Object.keys(parsed.data) },
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const c = await loadC(params.id);
    await requireProjectEditor(session.user.id, session.user.role, c.projectId);

    await prisma.competitor.delete({ where: { id: c.id } });

    await audit("COMPETITOR_DELETE", {
      userId: session.user.id,
      targetType: "Competitor",
      targetId: c.id,
      metadata: { name: c.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
