// 用户通知偏好：读取 / 批量更新。
// 每个用户、每种 NotificationType 一条记录（缺失时用默认值补齐）。
// 被 src/lib/notification/sender.ts 的 notify() 消费，决定站内 / 邮件 / 飞书 / 企微是否下发。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success, Errors } from "@/lib/api/response";
import { NotificationType } from "@prisma/client";

const ALL_TYPES = Object.values(NotificationType);

const prefSchema = z.object({
  type: z.nativeEnum(NotificationType),
  channelInApp: z.boolean(),
  channelEmail: z.boolean(),
  channelFeishu: z.boolean(),
  channelWeCom: z.boolean(),
});

const putSchema = z.object({
  preferences: z.array(prefSchema).min(1),
});

// GET /api/notification-preferences
// 返回当前用户全部类型的偏好；未落库的类型用默认值（仅站内开启）补齐。
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const existing = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byType = new Map(existing.map((p) => [p.type, p]));

    const preferences = ALL_TYPES.map((type) => {
      const p = byType.get(type);
      return {
        type,
        channelInApp: p?.channelInApp ?? true,
        channelEmail: p?.channelEmail ?? false,
        channelFeishu: p?.channelFeishu ?? false,
        channelWeCom: p?.channelWeCom ?? false,
      };
    });

    return success(preferences);
  } catch (err) {
    return handleError(err);
  }
}

// PUT /api/notification-preferences
// 批量 upsert 当前用户的偏好。
export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("通知偏好格式不正确", parsed.error.flatten());
    }

    // 同一 type 去重（保留最后一次）
    const dedup = new Map(parsed.data.preferences.map((p) => [p.type, p]));

    await prisma.$transaction(
      [...dedup.values()].map((p) =>
        prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: p.type } },
          create: {
            userId,
            type: p.type,
            channelInApp: p.channelInApp,
            channelEmail: p.channelEmail,
            channelFeishu: p.channelFeishu,
            channelWeCom: p.channelWeCom,
          },
          update: {
            channelInApp: p.channelInApp,
            channelEmail: p.channelEmail,
            channelFeishu: p.channelFeishu,
            channelWeCom: p.channelWeCom,
          },
        }),
      ),
    );

    return success({ count: dedup.size });
  } catch (err) {
    return handleError(err);
  }
}
