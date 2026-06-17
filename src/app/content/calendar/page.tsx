"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Draft {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  metaTitle: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "border-muted-foreground/30 bg-muted text-muted-foreground",
  PENDING_REVIEW: "border-warning/30 bg-warning/10 text-warning",
  APPROVED: "border-info/30 bg-info/10 text-info",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  PUBLISHED: "border-success/30 bg-success/10 text-success",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default function ContentCalendarPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/drafts?pageSize=200`);
      const json = await res.json();
      setDrafts(json.data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  // 当前月
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  // 周一开始
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 收集每个日期的草稿
  const draftsByDate: Record<string, Draft[]> = {};
  for (const d of drafts) {
    const dateKey = (d.publishedAt ?? d.updatedAt).slice(0, 10);
    if (!draftsByDate[dateKey]) draftsByDate[dateKey] = [];
    draftsByDate[dateKey].push(d);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M08 · CONTENT CALENDAR
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">内容日历</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            PROJECT :: {projectId || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthOffset((o) => o - 1)}
            className="btn-ghost"
          >
            ← PREV
          </button>
          <span className="font-mono text-sm text-foreground">
            {year}-{String(month + 1).padStart(2, "0")}
          </span>
          <button
            onClick={() => setMonthOffset((o) => o + 1)}
            className="btn-ghost"
          >
            NEXT →
          </button>
        </div>
      </div>

      {!projectId ? (
        <div className="card py-12 text-center font-mono text-xs text-muted-foreground">
          [ SELECT A PROJECT IN TOPBAR ]
        </div>
      ) : loading ? (
        <div className="card py-12 text-center">
          <span className="status-dot idle" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING</span>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          {/* 星期表头 */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                周{d}
              </div>
            ))}
          </div>
          {/* 日期网格 */}
          <div className="grid grid-cols-7">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-border bg-muted/10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday =
                day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              const dayDrafts = draftsByDate[dateKey] ?? [];
              return (
                <div
                  key={dateKey}
                  className={`min-h-[100px] border-b border-r border-border p-2 ${
                    isToday ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`mb-1 font-mono text-xs ${
                      isToday ? "text-gradient font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {String(day).padStart(2, "0")}
                  </div>
                  <div className="space-y-1">
                    {dayDrafts.slice(0, 3).map((d) => (
                      <Link
                        key={d.id}
                        href={`/content/drafts/${d.id}?projectId=${projectId}`}
                        className={`block truncate rounded border px-1.5 py-0.5 text-[10px] ${
                          STATUS_COLOR[d.status] ?? "border-border bg-muted text-foreground"
                        }`}
                        title={d.title}
                      >
                        {d.title}
                      </Link>
                    ))}
                    {dayDrafts.length > 3 && (
                      <div className="font-mono text-[10px] text-muted-foreground">
                        +{dayDrafts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 状态图例 */}
      <div className="card">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // STATUS LEGEND
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <span
              key={k}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${v}`}
            >
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
