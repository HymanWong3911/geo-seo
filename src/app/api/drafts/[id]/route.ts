// 单个草稿读取 / 更新 / 删除。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { ContentDraftStatus } from "@prisma/client";
import { Errors, handleError, success } from "@/lib/api/response";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  contentFormat: z.enum(["html", "markdown"]).optional(),
  excerpt: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  targetUrl: z.string().url().optional().nullable(),
  targetKeywords: z.array(z.string()).optional(),
  status: z.nativeEnum(ContentDraftStatus).optional(),
  changeNote: z.string().optional(),
});

async function loadDraft(id: string) {
  const d = await prisma.contentDraft.findUnique({ where: { id } });
  if (!d) throw Errors.notFound("草稿");
  return d;
}

async function getNextVersion(draftId: string): Promise<number> {
  const last = await prisma.contentRevision.findFirst({
    where: { draftId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (last?.version ?? 0) + 1;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const draft = await loadDraft(params.id);
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);
    return success(draft);
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
    const draft = await loadDraft(params.id);
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 内容变化 → 创建新版本
    const contentChanged =
      parsed.data.content !== undefined && parsed.data.content !== draft.content;
    const titleChanged =
      parsed.data.title !== undefined && parsed.data.title !== draft.title;

    const updated = await prisma.contentDraft.update({
      where: { id: draft.id },
      data: parsed.data,
    });

    if (contentChanged || titleChanged) {
      const version = await getNextVersion(draft.id);
      await prisma.contentRevision.create({
        data: {
          draftId: draft.id,
          version,
          title: updated.title,
          content: updated.content,
          contentFormat: updated.contentFormat,
          excerpt: updated.excerpt,
          metaTitle: updated.metaTitle,
          metaDescription: updated.metaDescription,
          changeNote: parsed.data.changeNote ?? null,
          createdById: session.user.id,
        },
      });
    }

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "update", contentChanged, titleChanged },
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
    const draft = await loadDraft(params.id);
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    if (draft.status === "PUBLISHED") {
      throw Errors.conflict("已发布的草稿不能删除");
    }

    // 软删（保留 30 天，硬删由 retention worker 处理）
    await prisma.contentDraft.update({
      where: { id: draft.id },
      data: { status: "ARCHIVED" },
    });

    await audit("DATA_DELETE", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "archive" },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
