"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AlertEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  channel: { name: string; type: string };
}

export default function AlertLogsPage() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/alert-events?pageSize=50");
    const json = await res.json();
    setEvents(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/settings/alerts" className="text-sm text-muted-foreground hover:underline">
          ← 返回告警通道
        </Link>
        <h1 className="text-2xl font-semibold">告警历史</h1>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">时间</th>
              <th className="px-3 py-2 text-left font-medium">通道</th>
              <th className="px-3 py-2 text-left font-medium">事件</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">内容</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">加载中...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">暂无告警记录</td></tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-sm">{e.channel.name}</div>
                    <div className="text-xs text-muted-foreground">{e.channel.type}</div>
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs">{e.eventType}</code>
                  </td>
                  <td className="px-3 py-2">
                    {e.status === "SUCCESS" ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-500" title={e.errorMessage ?? ""}>
                        ✗ {e.errorMessage ?? ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {Object.entries(e.payload).slice(0, 3).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
