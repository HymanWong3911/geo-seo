// 告警通道列表 + 创建（ADMIN 限定）。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { AlertChannelType, AlertEventType } from "@prisma/client";
import { Errors, handleError, success, created } from "@/lib/api/response";

const configSchema = z.union([
  z.object({ webhookUrl: z.string().url() }),  // 飞书 / 企微
  z.object({ to: z.array(z.string().email()) }),  // 邮件
]);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(AlertChannelType),
  config: configSchema,
  events: z.array(z.nativeEnum(AlertEventType)).min(1),
  active: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();
    const channels = await prisma.alertChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
    return success(channels);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const channel = await prisma.alertChannel.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        config: parsed.data.config,
        events: parsed.data.events,
        active: parsed.data.active,
      },
    });

    await audit("ALERT_CHANNEL_UPDATE", {
      userId: session.user.id,
      targetType: "AlertChannel",
      targetId: channel.id,
      metadata: { action: "create", name: channel.name, type: channel.type },
    });

    return created(channel);
  } catch (err) {
    return handleError(err);
  }
}
