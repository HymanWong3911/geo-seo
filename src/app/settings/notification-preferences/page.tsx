"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type NotificationType =
  | "COMMENT_MENTION"
  | "COMMENT_REPLY"
  | "TASK_ASSIGNED"
  | "TASK_DUE_SOON"
  | "GEO_ANOMALY"
  | "DRAFT_APPROVED"
  | "DRAFT_REJECTED"
  | "SYSTEM";

const TYPE_LABEL: Record<NotificationType, string> = {
  COMMENT_MENTION: "评论 @ 提及",
  COMMENT_REPLY: "评论回复",
  TASK_ASSIGNED: "任务分配",
  TASK_DUE_SOON: "任务即将到期",
  GEO_ANOMALY: "GEO 异常",
  DRAFT_APPROVED: "草稿通过",
  DRAFT_REJECTED: "草稿驳回",
  SYSTEM: "系统通知",
};

const TYPE_DESC: Record<NotificationType, string> = {
  COMMENT_MENTION: "有人在评论中 @ 提到你时",
  COMMENT_REPLY: "有人回复了你的评论",
  TASK_ASSIGNED: "任务被分配给你时",
  TASK_DUE_SOON: "你的任务在 24h 内到期",
  GEO_ANOMALY: "GEO 评分/提及率突降",
  DRAFT_APPROVED: "你的草稿通过审核",
  DRAFT_REJECTED: "你的草稿被驳回",
  SYSTEM: "系统级通知（升级 / 维护）",
};

const CHANNELS = [
  { key: "channelInApp", label: "站内", icon: "⌘" },
  { key: "channelEmail", label: "邮件", icon: "✉" },
  { key: "channelFeishu", label: "飞书", icon: "💬" },
  { key: "channelWeCom", label: "企微", icon: "💼" },
] as const;

type ChannelKey = (typeof CHANNELS)[number]["key"];

interface Preference {
  type: NotificationType;
  channelInApp: boolean;
  channelEmail: boolean;
  channelFeishu: boolean;
  channelWeCom: boolean;
}

const DEFAULT_PREFS: Preference[] = Object.keys(TYPE_LABEL).map((t) => ({
  type: t as NotificationType,
  channelInApp: true,
  channelEmail: false,
  channelFeishu: false,
  channelWeCom: false,
}));

export default function NotificationPreferencesPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<Preference[]>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    void (async () => {
      // 暂时从 localStorage 读（接口 GET /api/notification-preferences 待实现）
      const stored = typeof window !== "undefined" ? localStorage.getItem("notif-prefs") : null;
      if (stored) {
        try {
          setPrefs(JSON.parse(stored));
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
    })();
  }, [session?.user?.id]);

  function toggle(type: NotificationType, channel: ChannelKey) {
    setPrefs((prev) =>
      prev.map((p) =>
        p.type === type ? { ...p, [channel]: !p[channel] } : p,
      ),
    );
  }

  async function save() {
    setSaving(true);
    // 暂时存 localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("notif-prefs", JSON.stringify(prefs));
    }
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    alert("✓ 已保存");
  }

  function selectAll(channel: ChannelKey, value: boolean) {
    setPrefs((prev) => prev.map((p) => ({ ...p, [channel]: value })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M11 · NOTIFICATION PREFERENCES
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">通知偏好</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            USER · {session?.user?.email}
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {loading ? (
        <div className="card py-12 text-center">
          <span className="status-dot idle" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING</span>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr>
                  <th>TYPE</th>
                  {CHANNELS.map((c) => (
                    <th key={c.key} className="w-28 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base">{c.icon}</span>
                        <span>{c.label}</span>
                        <div className="mt-1 flex gap-1 font-sans">
                          <button
                            type="button"
                            onClick={() => selectAll(c.key, true)}
                            className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            全开
                          </button>
                          <button
                            type="button"
                            onClick={() => selectAll(c.key, false)}
                            className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            全关
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prefs.map((p) => (
                  <tr key={p.type}>
                    <td>
                      <div className="font-mono text-sm font-semibold">
                        {TYPE_LABEL[p.type]}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {TYPE_DESC[p.type]}
                      </div>
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c.key} className="text-center">
                        <button
                          type="button"
                          onClick={() => toggle(p.type, c.key)}
                          className={`inline-flex h-6 w-11 items-center rounded-full border transition-all ${
                            p[c.key]
                              ? "border-primary/40 bg-primary/30"
                              : "border-border bg-muted"
                          }`}
                          aria-pressed={p[c.key]}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                              p[c.key] ? "translate-x-6 bg-primary" : "translate-x-1 bg-muted-foreground"
                            }`}
                          />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // CHANNEL DOCS
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="font-mono text-xs text-primary">⌘ 站内</span>
                {" "}— 永远开启，会出现在 /notifications 中心
              </li>
              <li>
                <span className="font-mono text-xs text-primary">✉ 邮件</span>
                {" "}— 通过 SMTP（ALERT_SMTP_* 环境变量）发送
              </li>
              <li>
                <span className="font-mono text-xs text-primary">💬 飞书</span>
                {" "}— 通过飞书机器人 webhook（ALERT_FEISHU_WEBHOOK_URL）
              </li>
              <li>
                <span className="font-mono text-xs text-primary">💼 企微</span>
                {" "}— 通过企微机器人 webhook（ALERT_WECOM_WEBHOOK_URL）
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
