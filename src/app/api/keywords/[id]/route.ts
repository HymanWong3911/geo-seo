// 单个关键词读取 / 更新 / 删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateKeywordSchema } from "@/lib/api/validators/keyword";
import { Errors, handleError, success } from "@/lib/api/response";

async function loadKeyword(id: string) {
  const k = await prisma.keyword.findUnique({
    where: { id },
    include: { project: { select: { id: true } } },
  });
  if (!k) throw Errors.notFound("关键词");
  return k;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const keyword = await loadKeyword(params.id);
    await requireProjectEditor(session.user.id, session.user.role, keyword.projectId);
    return success(keyword);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const keyword = await loadKeyword(params.id);
    await requireProjectEditor(session.user.id, session.user.role, keyword.projectId);

    const body = await req.json();
    const parsed = updateKeywordSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.keyword.update({
      where: { id: keyword.id },
      data: parsed.data,
    });

    await audit("KEYWORD_UPDATE", {
      userId: session.user.id,
      targetType: "Keyword",
      targetId: keyword.id,
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
    const keyword = await loadKeyword(params.id);
    await requireProjectEditor(session.user.id, session.user.role, keyword.projectId);

    await prisma.keyword.delete({ where: { id: keyword.id } });

    await audit("KEYWORD_DELETE", {
      userId: session.user.id,
      targetType: "Keyword",
      targetId: keyword.id,
      metadata: { text: keyword.text },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
