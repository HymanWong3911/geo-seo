"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DonutChart, BarChart, EmptyState } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";

interface ReviewItem {
  id: string;
  title: string;
  sourceType: string;
  excerpt: string | null;
  authorId: string;
  submittedAt: string;
  createdAt: string;
  project: { id: string; name: string };
}

const SOURCE_LABELS: Record<string, string> = {
  AI_GENERATED: "🤖 AI 生成",
  MANUAL: "✍️ 手动",
  CONTENT_AUDIT: "📋 诊断改写",
  SEO_RECOMMENDATION: "🔍 SEO 建议",
};

function urgencyLevel(submittedAt: string): { level: "fresh" | "normal" | "urgent" | "overdue"; label: string; color: string; borderColor: string } {
  const hours = (Date.now() - new Date(submittedAt).getTime()) / 3600_000;
  if (hours < 4) return { level: "fresh", label: "刚提交", color: "text-info", borderColor: "border-info/30" };
  if (hours < 24) return { level: "normal", label: `${Math.round(hours)}h`, color: "text-muted-foreground", borderColor: "border-warning/30" };
  if (hours < 48) return { level: "urgent", label: `${Math.round(hours)}h 紧急`, color: "text-warning", borderColor: "border-warning/50" };
  return { level: "overdue", label: `${Math.round(hours)}h 超期`, color: "text-destructive", borderColor: "border-destructive/50" };
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const projectsRes = await fetch("/api/projects?pageSize=100");
    const projectsJson = await projectsRes.json();
    const projects = projectsJson.data ?? [];

    const all: ReviewItem[] = [];
    for (const p of projects) {
      const res = await fetch(`/api/projects/${p.id}/drafts?status=PENDING_REVIEW`);
      const json = await res.json();
      if (json.data) {
        for (const d of json.data) {
          all.push({
            ...d,
            submittedAt: d.submittedAt ?? d.updatedAt ?? d.createdAt,
            project: { id: p.id, name: p.name },
          });
        }
      }
    }
    all.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    setItems(all);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  // 统计
  const stats = useMemo(() => {
    const total = items.length;
    let fresh = 0, normal = 0, urgent = 0, overdue = 0;
    for (const it of items) {
      const h = (Date.now() - new Date(it.submittedAt).getTime()) / 3600_000;
      if (h < 4) fresh++;
      else if (h < 24) normal++;
      else if (h < 48) urgent++;
      else overdue++;
    }
    return { total, fresh, normal, urgent, overdue };
  }, [items]);

  // 按项目分布柱图
  const projectBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.project.name, (m.get(it.project.name) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [items]);

  // 按 sourceType 柱图
  const sourceBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.sourceType, (m.get(it.sourceType) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: SOURCE_LABELS[k] ?? k, value: v }));
  }, [items]);

  // 紧迫度分布
  const urgencyBreakdown = useMemo(() => {
    const segs: Array<{ label: string; value: number; color: string }> = [];
    if (stats.fresh > 0) segs.push({ label: "刚提交 < 4h", value: stats.fresh, color: "hsl(217 91% 60%)" });
    if (stats.normal > 0) segs.push({ label: "4-24h", value: stats.normal, color: "hsl(220 9% 46%)" });
    if (stats.urgent > 0) segs.push({ label: "24-48h", value: stats.urgent, color: "hsl(38 92% 50%)" });
    if (stats.overdue > 0) segs.push({ label: "> 48h 超期", value: stats.overdue, color: "hsl(0 84% 60%)" });
    return segs;
  }, [stats]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// CONTENT — Review Queue</div>
          <h1 className="mt-2">审核队列</h1>
          <p className="text-sm text-muted-foreground mt-1">所有项目里待审的内容,按提交时间倒序排列</p>
        </div>
        <div className="page-header-right">
          <button onClick={() => void load()} disabled={loading} className="btn-ghost">
            {loading ? "刷新中..." : "↻ 刷新"}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="eyebrow">total_pending</div>
              <div className="metric-number mt-1">{stats.total}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">fresh · &lt; 4h</div>
              <div className="metric-number mt-1 text-info">{stats.fresh}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">normal · 4-24h</div>
              <div className="metric-number mt-1 text-muted-foreground">{stats.normal}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">urgent · 24-48h</div>
              <div className={`metric-number mt-1 ${stats.urgent > 0 ? "text-warning" : "text-muted-foreground"}`}>{stats.urgent}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">overdue · &gt; 48h</div>
              <div className={`metric-number mt-1 ${stats.overdue > 0 ? "text-destructive" : "text-success"}`}>{stats.overdue}</div>
            </div>
          </div>

          {/* 可视化区 */}
          {stats.total > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="card p-4">
                <h3 className="eyebrow mb-3">urgency_breakdown</h3>
                <DonutChart
                  segments={urgencyBreakdown}
                  centerLabel="pending"
                  centerValue={stats.total}
                  size={120}
                  thickness={14}
                />
              </div>
              <div className="card p-4">
                <h3 className="eyebrow mb-3">by_project</h3>
                {projectBreakdown.length > 0 ? (
                  <BarChart data={projectBreakdown} defaultColor="hsl(var(--primary))" />
                ) : (
                  <EmptyState icon="∅" description="暂无" />
                )}
              </div>
              <div className="card p-4">
                <h3 className="eyebrow mb-3">by_source</h3>
                {sourceBreakdown.length > 0 ? (
                  <BarChart data={sourceBreakdown} defaultColor="hsl(var(--info))" />
                ) : (
                  <EmptyState icon="∅" description="暂无" />
                )}
              </div>
            </div>
          )}

          {/* 列表 */}
          {stats.total === 0 ? (
            <EmptyState
              icon="✨"
              title="审核队列清空了"
              description="所有项目里都没有待审草稿,完美!"
              action={
                <Link href="/content/drafts" className="btn-ghost">
                  → 查看所有草稿
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((d) => {
                const urg = urgencyLevel(d.submittedAt);
                return (
                  <Link
                    key={d.id}
                    href={`/content/drafts/${d.id}?projectId=${d.project.id}`}
                    className={`block card p-4 card-hover border-l-4 ${urg.borderColor}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground truncate">{d.title}</span>
                          <span className={`badge text-[10px] ${urg.level === "overdue" ? "bg-destructive/20 text-destructive border border-destructive/30" : urg.level === "urgent" ? "bg-warning/20 text-warning border border-warning/30" : "bg-muted text-muted-foreground border border-border"}`}>
                            {urg.label}
                          </span>
                        </div>
                        {d.excerpt && (
                          <div className="text-sm text-muted-foreground line-clamp-1">{d.excerpt}</div>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                          <span className="text-primary">{d.project.name}</span>
                          <span>·</span>
                          <span>{SOURCE_LABELS[d.sourceType] ?? d.sourceType}</span>
                          <span>·</span>
                          <span>提交 {new Date(d.submittedAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <span className="badge bg-warning/20 text-warning border border-warning/40 text-[10px] shrink-0">
                        待审
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
