// 告警系统。
// 详细说明见 dev doc v1.2 26 节。
// 3 个通道：飞书 / 企微 / 邮件。
// 5 分钟去重窗口。
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { redis } from "@/lib/queue";
import type { AlertEventType, JobStatus } from "@prisma/client";

interface SendAlertInput {
  eventType: AlertEventType;
  payload: Record<string, unknown>;
}

const DEDUPE_WINDOW_SEC = parseInt(process.env.ALERT_DEDUPE_WINDOW_MIN ?? "5") * 60;

async function isDuplicate(key: string): Promise<boolean> {
  const setKey = `alert:dedupe:${key}`;
  const set = await redis.set(setKey, "1", "EX", DEDUPE_WINDOW_SEC, "NX");
  return set === null;
}

async function sendFeishu(webhookUrl: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { tag: "plain", content: "GEO 告警" },
          },
          elements: [
            { tag: "div", text: { tag: "lark_md", content: formatMarkdown(payload) } },
          ],
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[alert:feishu]", err);
    return false;
  }
}

async function sendWeCom(webhookUrl: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: { content: formatMarkdown(payload) },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[alert:wecom]", err);
    return false;
  }
}

function formatMarkdown(p: Record<string, unknown>): string {
  const lines: string[] = [];
  if (p.title) lines.push(`**${p.title}**`);
  for (const [k, v] of Object.entries(p)) {
    if (k === "title") continue;
    lines.push(`- ${k}: ${v}`);
  }
  return lines.join("\n");
}

export async function sendAlert(input: SendAlertInput): Promise<void> {
  // 加载所有启用 + 订阅此 event 的通道
  const channels = await prisma.alertChannel.findMany({
    where: {
      active: true,
      events: { has: input.eventType },
    },
  });

  // 默认收件人（用户邮箱，从 env）
  const defaultRecipients = (process.env.ALERT_DEFAULT_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const channel of channels) {
    const dedupeKey = `${channel.id}:${input.eventType}:${JSON.stringify(input.payload).slice(0, 100)}`;
    if (await isDuplicate(dedupeKey)) continue;

    let status: JobStatus = "RUNNING";
    let errorMessage: string | undefined;
    try {
      const config = channel.config as Record<string, unknown>;
      let success = false;
      if (channel.type === "FEISHU" && typeof config.webhookUrl === "string") {
        success = await sendFeishu(config.webhookUrl, input.payload);
      } else if (channel.type === "WECOM" && typeof config.webhookUrl === "string") {
        success = await sendWeCom(config.webhookUrl, input.payload);
      } else if (channel.type === "EMAIL") {
        const to = (Array.isArray(config.to) ? config.to : defaultRecipients) as string[];
        if (to.length > 0) {
          const title = String(input.payload.title ?? "GEO 告警");
          await sendMail({
            to,
            subject: title,
            text: formatMarkdown(input.payload),
          });
          success = true;
        }
      }
      status = success ? "SUCCESS" : "FAILED";
      if (!success) errorMessage = "发送失败";
    } catch (err) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await prisma.alertEvent.create({
      data: {
        channelId: channel.id,
        eventType: input.eventType,
        payload: input.payload as object,
        status,
        errorMessage,
        sentAt: status === "SUCCESS" ? new Date() : null,
      },
    });
  }
}

export async function sendDailySummary(stats: {
  projectCount: number;
  successCount: number;
  failedCount: number;
  failedProjects: Array<{ name: string; error: string }>;
  totalCost: number;
}): Promise<void> {
  await sendAlert({
    eventType: "DAILY_GEO_SUMMARY",
    payload: {
      title: `【每日 GEO 监测汇总】${new Date().toISOString().slice(0, 10)}`,
      项目数: stats.projectCount,
      成功: stats.successCount,
      失败: stats.failedCount,
      失败项目: stats.failedProjects.length > 0
        ? stats.failedProjects.map((p) => `${p.name}（${p.error}）`).join("\n")
        : "无",
      LLM今日成本: `¥${stats.totalCost.toFixed(2)}`,
    },
  });
}
