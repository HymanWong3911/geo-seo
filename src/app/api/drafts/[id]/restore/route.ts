// 草稿回滚到指定版本。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; version: string } },
) {
  try {
    const session = await requireSession();
    const draft = await prisma.contentDraft.findUnique({ where: { id: params.id } });
    if (!draft) throw Errors.notFound("草稿");
    await requireProjectEditor(session.user.id, session.user.role, draft.projectId);

    const version = parseInt(params.version);
    if (isNaN(version)) {
      throw Errors.badRequest("version 必须是数字");
    }

    const target = await prisma.contentRevision.findUnique({
      where: { draftId_version: { draftId: draft.id, version } },
    });
    if (!target) throw Errors.notFound("版本不存在");

    // 把目标版本内容复制到当前草稿
    const updated = await prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        title: target.title,
        content: target.content,
        contentFormat: target.contentFormat,
        excerpt: target.excerpt,
        metaTitle: target.metaTitle,
        metaDescription: target.metaDescription,
      },
    });

    // 创建新版本记录这次回滚
    const lastVersion = await prisma.contentRevision.findFirst({
      where: { draftId: draft.id },
      orderBy: { version: "desc" },
    });
    await prisma.contentRevision.create({
      data: {
        draftId: draft.id,
        version: (lastVersion?.version ?? 0) + 1,
        title: target.title,
        content: target.content,
        contentFormat: target.contentFormat,
        excerpt: target.excerpt,
        metaTitle: target.metaTitle,
        metaDescription: target.metaDescription,
        changeNote: `回滚到 v${version}`,
        createdById: session.user.id,
      },
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "restore", fromVersion: version },
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}
