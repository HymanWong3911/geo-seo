"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { DonutChart, BarChart, Sparkline, EmptyState } from "@/components/ui/DashboardWidgets";

interface Draft {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED" | "ARCHIVED";
  sourceType: string;
  provenance: { kind?: string; provider?: string; synthetic?: boolean } | null;
  excerpt: string | null;
  authorId: string;
  updatedAt: string;
  createdAt: string;
  _count: { revisions: number };
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  PENDING_REVIEW: "bg-warning/15 text-warning border border-warning/30",
  APPROVED: "bg-success/15 text-success border border-success/30",
  REJECTED: "bg-destructive/15 text-destructive border border-destructive/30",
  PUBLISHED: "bg-info/15 text-info border border-info/30",
  ARCHIVED: "bg-muted text-muted-foreground border border-border",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审",
  APPROVED: "已审",
  REJECTED: "已驳回",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const SOURCE_LABELS: Record<string, string> = {
  AI_GENERATED: "🤖 AI 生成",
  AI_REWRITTEN: "✨ AI 改写",
  MANUAL: "✍️ 手动",
  IMPORTED: "📥 导入",
};

const STATUS_DONUT_COLORS: Record<string, string> = {
  DRAFT: "hsl(220 9% 46%)",
  PENDING_REVIEW: "hsl(38 92% 50%)",
  APPROVED: "hsl(142 71% 45%)",
  REJECTED: "hsl(0 84% 60%)",
  PUBLISHED: "hsl(217 91% 60%)",
  ARCHIVED: "hsl(220 14% 70%)",
};

export default function DraftsListPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");

  const load = useCallback(async () => {
    if (!projectId) { setDrafts([]); return; }
    setLoading(true);
    const url = new URL(`/api/projects/${projectId}/drafts`, window.location.origin);
    if (statusFilter) url.searchParams.set("status", statusFilter);
    const res = await fetch(url);
    const json = await res.json();
    setDrafts(json.data ?? []);
    setLoading(false);
  }, [projectId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // 过滤
  const filtered = useMemo(() => drafts.filter(d => {
    if (sourceFilter && d.sourceType !== sourceFilter) return false;
    if (searchQ && !d.title.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [drafts, sourceFilter, searchQ]);

  // KPI 统计
  const stats = useMemo(() => ({
    total: drafts.length,
    draft: drafts.filter(d => d.status === "DRAFT").length,
    pending: drafts.filter(d => d.status === "PENDING_REVIEW").length,
    approved: drafts.filter(d => d.status === "APPROVED").length,
    published: drafts.filter(d => d.status === "PUBLISHED").length,
    rejected: drafts.filter(d => d.status === "REJECTED").length,
    ai: drafts.filter(d => d.sourceType === "AI_GENERATED").length,
  }), [drafts]);

  // 状态分布饼图
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of drafts) counts[d.status] = (counts[d.status] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ label: STATUS_LABEL[k] ?? k, value: v, color: STATUS_DONUT_COLORS[k] ?? "hsl(220 9% 60%)" }))
      .sort((a, b) => b.value - a.value);
  }, [drafts]);

  // 来源柱图
  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of drafts) counts[d.sourceType] = (counts[d.sourceType] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: SOURCE_LABELS[k] ?? k, value: v }));
  }, [drafts]);

  // 7 天创建 trend
  const creationTrend = useMemo(() => {
    const days = 7;
    const buckets: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const cnt = drafts.filter(x => {
        const t = new Date(x.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      buckets.push(cnt);
    }
    return buckets;
  }, [drafts]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// CONTENT — Drafts</div>
          <h1 className="mt-2">内容草稿</h1>
          <p className="text-sm text-muted-foreground mt-1">AI 生成 + 手动编写 + 诊断改写,所有草稿集中管理</p>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <Link
              href={`/content/drafts/new?projectId=${projectId}`}
              className="btn-primary"
            >
              + 新建草稿
            </Link>
          )}
        </div>
      </header>

      {!projectId ? (
        <EmptyState icon="◎" title="选择项目" description="先在右上角选择一个项目,开始管理草稿" />
      ) : (
        <>
          {/* KPI */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : drafts.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="card p-4">
                  <div className="eyebrow">total</div>
                  <div className="metric-number mt-1">{stats.total}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">pending_review</div>
                  <div className={`metric-number mt-1 ${stats.pending > 0 ? "text-warning" : "text-muted-foreground"}`}>{stats.pending}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">approved</div>
                  <div className="metric-number mt-1 text-success">{stats.approved}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">published</div>
                  <div className="metric-number mt-1 text-info">{stats.published}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">ai_generated</div>
                  <div className="metric-number mt-1 text-primary">{stats.ai}</div>
                  <div className="mt-1"><Sparkline data={creationTrend} color="hsl(var(--primary))" /></div>
                </div>
              </div>

              {/* 可视化区 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="card p-4">
                  <h3 className="eyebrow mb-3">status_breakdown</h3>
                  {statusBreakdown.length > 0 ? (
                    <DonutChart
                      segments={statusBreakdown}
                      centerLabel="drafts"
                      centerValue={stats.total}
                      size={120}
                      thickness={14}
                    />
                  ) : (
                    <EmptyState icon="∅" description="暂无草稿" />
                  )}
                </div>
                <div className="card p-4 lg:col-span-2">
                  <h3 className="eyebrow mb-3">source_breakdown</h3>
                  {sourceBreakdown.length > 0 ? (
                    <BarChart data={sourceBreakdown} defaultColor="hsl(var(--primary))" />
                  ) : (
                    <EmptyState icon="∅" description="暂无数据" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* 筛选区 */}
          {!loading && drafts.length > 0 && (
            <div className="space-y-3">
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setStatusFilter("")}
                  className={`badge cursor-pointer ${!statusFilter ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-border"}`}
                >全部</button>
                {(["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`badge cursor-pointer ${statusFilter === s ? STATUS_BADGE[s] : "bg-muted text-muted-foreground border border-border"}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap items-center">
                <input
                  type="text"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="搜索标题..."
                  className="input-field flex-1 min-w-[200px]"
                />
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="input-field w-48"
                >
                  <option value="">all_sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 列表 */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="📝"
              title={drafts.length === 0 ? "还没有任何草稿" : "没有匹配的草稿"}
              description={drafts.length === 0 ? "点击右上角「新建草稿」,AI 一键生成或手动创建" : "试试调整筛选条件"}
              action={drafts.length === 0 ? (
                <Link href={`/content/drafts/new?projectId=${projectId}`} className="btn-primary">
                  + 新建草稿
                </Link>
              ) : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => (
                <Link
                  key={d.id}
                  href={`/content/drafts/${d.id}?projectId=${projectId}`}
                  className="block card p-4 card-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground group-hover:text-primary">{d.title}</div>
                      {d.excerpt && (
                        <div className="mt-1 text-sm text-muted-foreground line-clamp-1">{d.excerpt}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`badge text-[10px] ${STATUS_BADGE[d.status]}`}>
                        {STATUS_LABEL[d.status]}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {SOURCE_LABELS[d.sourceType] ?? d.sourceType} · v{d._count.revisions}
                      </span>
                      {d.provenance?.synthetic && (
                        <span className="badge border border-warning/40 bg-warning/10 text-[10px] text-warning">
                          {d.provenance.kind === "template-fallback" ? "模板兜底" : "Mock 测试"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                    更新 {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
