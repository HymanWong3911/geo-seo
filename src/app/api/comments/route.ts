// 评论列表 + 创建。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { notify, notifyMany } from "@/lib/notification/sender";
import { Errors, handleError, success, created } from "@/lib/api/response";

const createSchema = z.object({
  targetType: z.enum(["Task", "ContentDraft", "PageAudit", "GeoRun", "Project", "Optimization"]),
  targetId: z.string().min(1),
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),     // userId 列表
  parentId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");

    if (!targetType || !targetId) {
      throw Errors.badRequest("缺少 targetType 或 targetId");
    }

    const comments = await prisma.comment.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return success(comments);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const comment = await prisma.comment.create({
      data: {
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        authorId: session.user.id,
        content: parsed.data.content,
        mentions: parsed.data.mentions,
        parentId: parsed.data.parentId ?? null,
      },
    });

    // 通知 @ 提及的人
    if (parsed.data.mentions.length > 0) {
      await notifyMany(parsed.data.mentions, {
        type: "COMMENT_MENTION",
        title: `${session.user.name ?? session.user.email} 在评论中提到了你`,
        content: parsed.data.content.slice(0, 200),
        link: `/${parsed.data.targetType.toLowerCase()}/${parsed.data.targetId}`,
        metadata: { commentId: comment.id, targetType: parsed.data.targetType, targetId: parsed.data.targetId },
      });
    }

    // 通知评论作者（如果是回复）
    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } });
      if (parent && parent.authorId !== session.user.id) {
        await notify({
          userId: parent.authorId,
          type: "COMMENT_REPLY",
          title: `${session.user.name ?? session.user.email} 回复了你的评论`,
          content: parsed.data.content.slice(0, 200),
          link: `/${parsed.data.targetType.toLowerCase()}/${parsed.data.targetId}`,
        });
      }
    }

    await audit("REPORT_EXPORT", {
      // 复用枚举：v1.1 没 COMMENT_CREATE，可加
      userId: session.user.id,
      targetType: "Comment",
      targetId: comment.id,
      metadata: { targetType: parsed.data.targetType, targetId: parsed.data.targetId, mentions: parsed.data.mentions.length },
    });

    return created(comment);
  } catch (err) {
    return handleError(err);
  }
}
