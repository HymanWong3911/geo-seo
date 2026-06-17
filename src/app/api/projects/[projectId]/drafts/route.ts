// 草稿列表 + 创建。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { ContentSource, ContentDraftStatus } from "@prisma/client";
import { Errors, handleError, paginated, created } from "@/lib/api/response";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  contentFormat: z.enum(["html", "markdown"]).default("markdown"),
  excerpt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  sourceType: z.nativeEnum(ContentSource).default("MANUAL"),
  targetUrl: z.string().url().optional(),
  targetKeywords: z.array(z.string()).default([]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);
    const status = url.searchParams.get("status");

    const where = {
      projectId: params.projectId,
      ...(status ? { status: status as never } : {}),
    };

    const [drafts, total] = await Promise.all([
      prisma.contentDraft.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { revisions: true } },
        },
      }),
      prisma.contentDraft.count({ where }),
    ]);

    return paginated(drafts, total, page, pageSize);
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const draft = await prisma.contentDraft.create({
      data: {
        projectId: params.projectId,
        title: parsed.data.title,
        content: parsed.data.content,
        contentFormat: parsed.data.contentFormat,
        excerpt: parsed.data.excerpt ?? null,
        metaTitle: parsed.data.metaTitle ?? null,
        metaDescription: parsed.data.metaDescription ?? null,
        sourceType: parsed.data.sourceType,
        targetUrl: parsed.data.targetUrl ?? null,
        targetKeywords: parsed.data.targetKeywords,
        authorId: session.user.id,
      },
    });

    // 创建初始 revision（版本 1）
    await prisma.contentRevision.create({
      data: {
        draftId: draft.id,
        version: 1,
        title: draft.title,
        content: draft.content,
        contentFormat: draft.contentFormat,
        excerpt: draft.excerpt,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        createdById: session.user.id,
      },
    });

    await audit("REPORT_EXPORT", {
      // 复用枚举（v1.1 没 DRAFT_CREATE，可加）
      userId: session.user.id,
      targetType: "ContentDraft",
      targetId: draft.id,
      metadata: { action: "create", sourceType: draft.sourceType, projectId: params.projectId },
    });

    return created(draft);
  } catch (err) {
    return handleError(err);
  }
}
