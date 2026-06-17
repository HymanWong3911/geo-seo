// 单个 GEO 问题读取 / 更新 / 删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateGeoQuestionSchema } from "@/lib/api/validators/geo";
import { Errors, handleError, success } from "@/lib/api/response";

async function loadQ(id: string) {
  const q = await prisma.geoQuestion.findUnique({ where: { id } });
  if (!q) throw Errors.notFound("GEO 问题");
  return q;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const q = await loadQ(params.id);
    await requireProjectEditor(session.user.id, session.user.role, q.projectId);

    const body = await req.json();
    const parsed = updateGeoQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.geoQuestion.update({
      where: { id: q.id },
      data: parsed.data,
    });

    await audit("GEO_QUESTION_UPDATE", {
      userId: session.user.id,
      targetType: "GeoQuestion",
      targetId: q.id,
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
    const q = await loadQ(params.id);
    await requireProjectEditor(session.user.id, session.user.role, q.projectId);

    await prisma.geoQuestion.delete({ where: { id: q.id } });

    await audit("GEO_QUESTION_DELETE", {
      userId: session.user.id,
      targetType: "GeoQuestion",
      targetId: q.id,
      metadata: { question: q.question },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
