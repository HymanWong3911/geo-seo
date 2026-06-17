"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  COMMENT_MENTION: "提到你",
  COMMENT_REPLY: "回复你",
  TASK_ASSIGNED: "任务分配",
  TASK_DUE_SOON: "任务到期",
  GEO_ANOMALY: "GEO 异常",
  DRAFT_APPROVED: "草稿通过",
  DRAFT_REJECTED: "草稿驳回",
  SYSTEM: "系统",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { t } = useI18n();

  async function load() {
    setLoading(true);
    const url = new URL("/api/notifications", window.location.origin);
    if (unreadOnly) url.searchParams.set("unread", "true");
    const res = await fetch(url);
    const json = await res.json();
    setItems(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">通知中心</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${unreadOnly ? "bg-primary text-primary-foreground" : ""}`}
          >
            仅未读
          </button>
          <button
            onClick={markAllRead}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            全部标记已读
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.notifications}</p>

      <div className="rounded-md border border-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">暂无通知</div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 border-b border-border p-4 last:border-0 ${!n.read ? "bg-blue-50" : ""}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                </div>
                <div className="mt-1 text-sm">{n.title}</div>
                {n.content && (
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {n.content}
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {n.link && (
                  <Link
                    href={n.link}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    查看
                  </Link>
                )}
                {!n.read && (
                  <button
                    onClick={() => void markRead(n.id)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    已读
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
