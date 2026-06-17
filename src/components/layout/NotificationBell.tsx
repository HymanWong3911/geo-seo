"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<{
    id: string;
    type: string;
    title: string;
    read: boolean;
    link: string | null;
    createdAt: string;
  }>>([]);

  async function load() {
    const res = await fetch("/api/notifications?pageSize=10");
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.data ?? []);
    setUnread(json.meta?.total ?? 0);
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    void load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-96 rounded-md border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="text-sm font-semibold">通知</div>
              <div className="flex gap-2 text-xs">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-blue-600 hover:underline">
                    全部已读
                  </button>
                )}
                <a
                  href="/notifications"
                  className="text-muted-foreground hover:underline"
                  onClick={(e) => { e.preventDefault(); router.push("/notifications"); setOpen(false); }}
                >
                  查看全部
                </a>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">暂无通知</div>
              ) : (
                items.map((n) => (
                  <a
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={(e) => {
                      if (!n.read) void markRead(n.id);
                      if (n.link) {
                        e.preventDefault();
                        router.push(n.link);
                        setOpen(false);
                      }
                    }}
                    className={`block border-b border-border p-3 text-sm hover:bg-muted ${!n.read ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm">{n.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
