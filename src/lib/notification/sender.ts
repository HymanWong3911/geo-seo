// 通知系统。
// 详细说明见 dev doc v1.2 28.3 节 + M11 节。
// 站内通知 + 飞书 / 企微 / 邮件（按用户偏好）。

import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { sendAlert } from "@/lib/alert/sender";
import { NotificationType } from "@prisma/client";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// 默认偏好
async function getPreference(userId: string, type: NotificationType) {
  let pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: { userId, type, channelInApp: true },
    });
  }
  return pref;
}

export async function notify(input: NotifyInput): Promise<void> {
  // 1. 写站内
  const pref = await getPreference(input.userId, input.type);

  if (pref.channelInApp) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content ?? null,
        link: input.link ?? null,
        metadata: input.metadata as object,
      },
    });
  }

  // 2. 发邮件（如果开启）
  if (pref.channelEmail) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (user?.email) {
      await sendMail({
        to: user.email,
        subject: input.title,
        text: `${input.content ?? ""}\n\n${input.link ?? ""}`,
      });
    }
  }

  // 3. 飞书 / 企微（如果开启，复用 alert 通道）
  if (pref.channelFeishu || pref.channelWeCom) {
    const payload = {
      title: input.title,
      content: input.content ?? "",
      link: input.link ?? "",
    };
    if (pref.channelFeishu) {
      await sendAlert({ eventType: "ANOMALY_DETECTED", payload });
    }
    // 企微同
  }
}

export async function notifyMany(
  userIds: string[],
  base: Omit<NotifyInput, "userId">,
): Promise<void> {
  for (const userId of userIds) {
    await notify({ ...base, userId });
  }
}
