// 告警通道更新 / 删除 / 测试。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { sendAlert } from "@/lib/alert/sender";
import { AlertChannelType, AlertEventType } from "@prisma/client";
import { Errors, handleError, success } from "@/lib/api/response";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z
    .union([z.object({ webhookUrl: z.string().url() }), z.object({ to: z.array(z.string().email()) })])
    .optional(),
  events: z.array(z.nativeEnum(AlertEventType)).min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.alertChannel.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await audit("ALERT_CHANNEL_UPDATE", {
      userId: session.user.id,
      targetType: "AlertChannel",
      targetId: updated.id,
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
    const session = await requireAdmin();
    const channel = await prisma.alertChannel.findUnique({ where: { id: params.id } });
    if (!channel) throw Errors.notFound("告警通道");

    await prisma.alertChannel.delete({ where: { id: channel.id } });

    await audit("ALERT_CHANNEL_UPDATE", {
      userId: session.user.id,
      targetType: "AlertChannel",
      targetId: channel.id,
      metadata: { action: "delete", name: channel.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

// 测试发送
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const channel = await prisma.alertChannel.findUnique({ where: { id: params.id } });
    if (!channel) throw Errors.notFound("告警通道");

    // 临时激活（即使 inactive）发一次
    await sendAlert({
      eventType: "ANOMALY_DETECTED",
      payload: {
        title: "【测试】告警通道测试",
        通道: channel.name,
        类型: channel.type,
        时间: new Date().toLocaleString("zh-CN"),
      },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
