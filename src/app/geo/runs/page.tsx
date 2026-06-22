"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { DonutChart, BarChart, Sparkline, EmptyState } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";

interface GeoRun {
  id: string;
  triggerType: string;
  provider: string;
  model: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL_FAILURE";
  questionIds: string[];
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  _count: { results: number };
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground border border-border",
  RUNNING: "bg-info/15 text-info border border-info/30",
  SUCCESS: "bg-success/15 text-success border border-success/30",
  PARTIAL_FAILURE: "bg-warning/15 text-warning border border-warning/30",
  FAILED: "bg-destructive/15 text-destructive border border-destructive/30",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待执行",
  RUNNING: "运行中",
  SUCCESS: "成功",
  PARTIAL_FAILURE: "部分失败",
  FAILED: "失败",
};

const STATUS_DONUT_COLORS: Record<string, string> = {
  PENDING: "hsl(220 9% 46%)",
  RUNNING: "hsl(217 91% 60%)",
  SUCCESS: "hsl(142 71% 45%)",
  PARTIAL_FAILURE: "hsl(38 92% 50%)",
  FAILED: "hsl(0 84% 60%)",
};

const PROVIDER_LABELS: Record<string, string> = {
  kimi: "🌙 Kimi",
  doubao: "🫘 豆包",
  perplexity: "🔮 Perplexity",
  llm_simulation: "🤖 LLM 模拟",
  openai: "🟢 OpenAI",
  anthropic: "🟣 Anthropic",
};

function calcDuration(startedAt: string | null, finishedAt: string | null): number | null {
  if (!startedAt || !finishedAt) return null;
  return Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function GeoRunsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [runs, setRuns] = useState<GeoRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");

  async function load() {
    if (!projectId) { setRuns([]); return; }
    setLoading(true);
    const url = new URL(`/api/projects/${projectId}/geo/runs`, window.location.origin);
    url.searchParams.set("pageSize", "100");
    const res = await fetch(url);
    const json = await res.json();
    setRuns(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]);

  const filtered = useMemo(() => runs.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (providerFilter && r.provider !== providerFilter) return false;
    return true;
  }), [runs, statusFilter, providerFilter]);

  // KPI
  const stats = useMemo(() => {
    const total = runs.length;
    const success = runs.filter(r => r.status === "SUCCESS").length;
    const failed = runs.filter(r => r.status === "FAILED").length;
    const running = runs.filter(r => r.status === "RUNNING").length;
    const partial = runs.filter(r => r.status === "PARTIAL_FAILURE").length;
    const durations = runs
      .map(r => calcDuration(r.startedAt, r.finishedAt))
      .filter((d): d is number => d !== null);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, failed, running, partial, avgDuration, successRate };
  }, [runs]);

  // 状态分布
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of runs) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => ({ label: STATUS_LABEL[k] ?? k, value: v, color: STATUS_DONUT_COLORS[k] ?? "hsl(220 9% 60%)" }))
      .sort((a, b) => b.value - a.value);
  }, [runs]);

  // Provider 柱图
  const providerBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) m.set(r.provider, (m.get(r.provider) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => ({ label: PROVIDER_LABELS[p] ?? p, value: v }));
  }, [runs]);

  // 7天 trend
  const dailyTrend = useMemo(() => {
    const days = 7;
    const buckets: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const cnt = runs.filter(r => {
        const t = new Date(r.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      buckets.push(cnt);
    }
    return buckets;
  }, [runs]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// GEO — Run History</div>
          <h1 className="mt-2">GEO 运行历史</h1>
          <p className="text-sm text-muted-foreground mt-1">查看每次 GEO 检测的运行结果、状态、耗时</p>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <Link href={`/geo?projectId=${projectId}`} className="btn-ghost">← GEO 监测</Link>
          )}
        </div>
      </header>

      {!projectId ? (
        <EmptyState icon="◎" title="选择项目" description="先在右上角选择一个项目,查看其 GEO 跑测历史" />
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="还没有 GEO 跑测"
          description="去 GEO 监测页面触发一次 AI 搜索引擎可见度检测"
          action={
            <Link href={`/geo?projectId=${projectId}`} className="btn-primary">
              → GEO 监测
            </Link>
          }
        />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="eyebrow">total_runs</div>
              <div className="metric-number mt-1">{stats.total}</div>
              <div className="mt-1"><Sparkline data={dailyTrend} color="hsl(var(--primary))" /></div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">success_rate</div>
              <div className={`metric-number mt-1 ${stats.successRate >= 80 ? "text-success" : stats.successRate >= 50 ? "text-warning" : "text-destructive"}`}>
                {stats.successRate}%
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">{stats.success} / {stats.total}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">running</div>
              <div className={`metric-number mt-1 ${stats.running > 0 ? "text-info animate-pulse" : "text-muted-foreground"}`}>{stats.running}</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">failed</div>
              <div className={`metric-number mt-1 ${stats.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.failed}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">+ {stats.partial} 部分失败</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">avg_duration</div>
              <div className="metric-number mt-1 text-primary">{stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : "—"}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">平均耗时</div>
            </div>
          </div>

          {/* 可视化区 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="card p-4">
              <h3 className="eyebrow mb-3">status_breakdown</h3>
              <DonutChart
                segments={statusBreakdown}
                centerLabel="runs"
                centerValue={stats.total}
                size={120}
                thickness={14}
              />
            </div>
            <div className="card p-4 lg:col-span-2">
              <h3 className="eyebrow mb-3">provider_breakdown</h3>
              {providerBreakdown.length > 0 ? (
                <BarChart data={providerBreakdown} defaultColor="hsl(var(--primary))" />
              ) : (
                <EmptyState icon="∅" description="暂无" />
              )}
            </div>
          </div>

          {/* 筛选 */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter("")}
                className={`badge cursor-pointer ${!statusFilter ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-border"}`}
              >全部</button>
              {(["RUNNING", "SUCCESS", "PARTIAL_FAILURE", "FAILED", "PENDING"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                  className={`badge cursor-pointer ${statusFilter === s ? STATUS_BADGE[s] : "bg-muted text-muted-foreground border border-border"}`}
                >{STATUS_LABEL[s]}</button>
              ))}
            </div>
            {providerBreakdown.length > 1 && (
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                className="input-field w-40"
              >
                <option value="">all_providers</option>
                {providerBreakdown.map(p => (
                  <option key={p.label} value={p.label.split(" ").pop() ?? ""}>{p.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 列表 */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left p-3">status</th>
                    <th className="text-left p-3">trigger</th>
                    <th className="text-left p-3">provider / model</th>
                    <th className="text-right p-3">questions</th>
                    <th className="text-right p-3">results</th>
                    <th className="text-right p-3">duration</th>
                    <th className="text-left p-3">started</th>
                    <th className="text-left p-3">finished</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
                        没有匹配的 run
                      </td>
                    </tr>
                  ) : (
                    filtered.map(r => {
                      const dur = calcDuration(r.startedAt, r.finishedAt);
                      return (
                        <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                          <td className="p-3">
                            <span className={`badge text-[10px] font-mono ${STATUS_BADGE[r.status]}`}>
                              {r.status === "RUNNING" && <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse mr-1" />}
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-mono">{r.triggerType}</span>
                          </td>
                          <td className="p-3">
                            <div className="text-xs font-mono">{PROVIDER_LABELS[r.provider] ?? r.provider}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{r.model}</div>
                          </td>
                          <td className="p-3 text-right font-mono text-xs">{r.questionIds.length}</td>
                          <td className="p-3 text-right font-mono text-xs text-primary">{r._count.results}</td>
                          <td className="p-3 text-right font-mono text-xs text-muted-foreground">
                            {dur !== null ? formatDuration(dur) : "—"}
                          </td>
                          <td className="p-3 text-xs font-mono text-muted-foreground">
                            {r.startedAt ? new Date(r.startedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                          </td>
                          <td className="p-3 text-xs font-mono text-muted-foreground">
                            {r.finishedAt ? new Date(r.finishedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
