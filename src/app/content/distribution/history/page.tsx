"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { DonutChart, BarChart, Sparkline, EmptyState } from "@/components/ui/DashboardWidgets";

interface DistributionLog {
  id: string;
  targetId: string;
  draftId: string | null;
  status: "SUCCESS" | "FAILED" | "PENDING";
  externalId: string | null;
  externalUrl: string | null;
  attempts: number;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  target: { name: string; platform: string };
  draft: { title: string } | null;
}

type TimeRange = "today" | "7d" | "30d" | "all";

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "bg-success/15 text-success border border-success/30",
  FAILED: "bg-destructive/15 text-destructive border border-destructive/30",
  PENDING: "bg-warning/15 text-warning border border-warning/30",
};

const PLATFORM_LABELS: Record<string, string> = {
  ZHIHU: "💬 知乎",
  WECHAT_MP: "💚 微信",
  FEISHU_DOC: "✈️ 飞书",
  NOTION: "📝 Notion",
  BAIJIAHAO: "📰 百家号",
  DOUYIN: "🎵 抖音",
  XIAOHONGSHU: "📕 小红书",
  COZE: "🤖 扣子",
  BAIDU_WENXIN: "🔍 文心",
  TENCENT_YUANBAO: "🐧 元宝",
  DINGTALK: "📌 钉钉",
  BAIDU_SEARCH: "🔎 百度",
  SOGOU_SEARCH: "🐶 搜狗",
  SO360_SEARCH: "🔱 360",
  SHENMA_SEARCH: "🐴 神马",
  CITATION_SITE: "📚 引用",
  INDEX_SITE: "🗂 收录",
  CUSTOM_WEBHOOK: "🔗 Webhook",
};

// 平台饼图色彩
const PLATFORM_COLORS: Record<string, string> = {
  ZHIHU: "hsl(217 91% 60%)",
  WECHAT_MP: "hsl(142 71% 45%)",
  FEISHU_DOC: "hsl(262 83% 58%)",
  NOTION: "hsl(0 0% 50%)",
  BAIJIAHAO: "hsl(14 90% 55%)",
  DOUYIN: "hsl(330 81% 60%)",
  XIAOHONGSHU: "hsl(346 84% 61%)",
  COZE: "hsl(187 95% 43%)",
  BAIDU_WENXIN: "hsl(217 91% 60%)",
  TENCENT_YUANBAO: "hsl(204 86% 50%)",
  DINGTALK: "hsl(217 91% 60%)",
  BAIDU_SEARCH: "hsl(217 91% 60%)",
  SOGOU_SEARCH: "hsl(38 92% 50%)",
  SO360_SEARCH: "hsl(142 71% 45%)",
  SHENMA_SEARCH: "hsl(280 70% 50%)",
  CITATION_SITE: "hsl(220 9% 46%)",
  INDEX_SITE: "hsl(220 9% 46%)",
  CUSTOM_WEBHOOK: "hsl(220 9% 46%)",
};

function timeRangeCutoff(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 3600 * 1000);
}

export default function DistributionHistoryPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [logs, setLogs] = useState<DistributionLog[]>([]);
  const [targets, setTargets] = useState<Array<{ id: string; name: string; platform: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!projectId) { setLogs([]); setTargets([]); setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [logsRes, targetsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/distribution-logs?limit=300`),
        fetch(`/api/projects/${projectId}/distribution-targets`),
      ]);
      const logsJson = await logsRes.json();
      const targetsJson = await targetsRes.json();
      setLogs(logsJson.data ?? []);
      setTargets(targetsJson.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const rangedLogs = useMemo(() => {
    const cutoff = timeRangeCutoff(timeRange);
    if (!cutoff) return logs;
    return logs.filter(l => {
      const t = l.sentAt || l.createdAt;
      return new Date(t).getTime() >= cutoff.getTime();
    });
  }, [logs, timeRange]);

  const filteredLogs = useMemo(() => rangedLogs.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (platformFilter && l.targetId !== platformFilter) return false;
    return true;
  }), [rangedLogs, statusFilter, platformFilter]);

  const stats = useMemo(() => ({
    total: rangedLogs.length,
    success: rangedLogs.filter(l => l.status === "SUCCESS").length,
    failed: rangedLogs.filter(l => l.status === "FAILED").length,
    pending: rangedLogs.filter(l => l.status === "PENDING").length,
    successRate: rangedLogs.length > 0 ? Math.round((rangedLogs.filter(l => l.status === "SUCCESS").length / rangedLogs.length) * 100) : 0,
  }), [rangedLogs]);

  // 平台柱图
  const platformBar = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of rangedLogs) {
      const key = l.target.platform;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([p, v]) => ({
        label: PLATFORM_LABELS[p] ?? p,
        value: v,
        color: PLATFORM_COLORS[p] ?? "hsl(220 9% 50%)",
      }));
  }, [rangedLogs]);

  // 状态饼图
  const statusBreakdown = useMemo(() => {
    const segs: Array<{ label: string; value: number; color: string }> = [];
    if (stats.success > 0) segs.push({ label: "成功", value: stats.success, color: "hsl(142 71% 45%)" });
    if (stats.failed > 0) segs.push({ label: "失败", value: stats.failed, color: "hsl(0 84% 60%)" });
    if (stats.pending > 0) segs.push({ label: "待处理", value: stats.pending, color: "hsl(38 92% 50%)" });
    return segs;
  }, [stats]);

  // 7 天 trend
  const dailyTrend = useMemo(() => {
    const days = 7;
    const buckets: Array<{ date: string; success: number; failed: number; pending: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const dayLogs = logs.filter(l => {
        const t = new Date(l.sentAt || l.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      buckets.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        success: dayLogs.filter(l => l.status === "SUCCESS").length,
        failed: dayLogs.filter(l => l.status === "FAILED").length,
        pending: dayLogs.filter(l => l.status === "PENDING").length,
      });
    }
    return buckets;
  }, [logs]);

  const errorGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of rangedLogs) {
      if (l.status === "FAILED" && l.errorMessage) {
        const key = l.errorMessage.split(/[，。:：]/)[0].trim().substring(0, 30);
        m.set(key, (m.get(key) ?? 0) + 1);
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rangedLogs]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, DistributionLog[]> = {};
    for (const l of filteredLogs) {
      const d = new Date(l.sentAt || l.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  async function retryLog(log: DistributionLog) {
    if (!log.draftId) return;
    setRetryingId(log.id);
    try {
      await fetch(`/api/distribution-logs/${log.id}/retry`, { method: "POST" });
      await load(true);
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// DISTRIBUTION — History</div>
          <h1 className="mt-2">分发历史</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            className="btn-ghost"
            title="刷新"
          >
            {refreshing ? "刷新中..." : "↻ 刷新"}
          </button>
        </div>
      </header>

      {/* 时间范围 Tab */}
      <div className="flex gap-2 flex-wrap">
        {([
          ["today", "今日"],
          ["7d", "近 7 天"],
          ["30d", "近 30 天"],
          ["all", "全部"],
        ] as Array<[TimeRange, string]>).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTimeRange(v)}
            className={`badge cursor-pointer ${
              timeRange === v
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI 卡片 */}
      {!loading && rangedLogs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-4">
            <div className="eyebrow">total</div>
            <div className="metric-number mt-1">{stats.total}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">success</div>
            <div className="metric-number mt-1 text-success">{stats.success}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">failed</div>
            <div className={`metric-number mt-1 ${stats.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.failed}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">pending</div>
            <div className={`metric-number mt-1 ${stats.pending > 0 ? "text-warning" : "text-muted-foreground"}`}>{stats.pending}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">success_rate</div>
            <div className={`metric-number mt-1 ${stats.successRate >= 80 ? "text-success" : stats.successRate >= 50 ? "text-warning" : "text-destructive"}`}>{stats.successRate}%</div>
            <div className="mt-1"><Sparkline data={dailyTrend.map(d => d.success)} color="hsl(142 71% 45%)" /></div>
          </div>
        </div>
      )}

      {/* 可视化区 */}
      {!loading && rangedLogs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card p-4">
            <h3 className="eyebrow mb-3">status_breakdown</h3>
            <DonutChart
              segments={statusBreakdown}
              centerLabel="rate"
              centerValue={`${stats.successRate}%`}
              size={120}
              thickness={14}
            />
          </div>
          <div className="card p-4 lg:col-span-2">
            <h3 className="eyebrow mb-3">by_platform</h3>
            {platformBar.length > 0 ? (
              <BarChart data={platformBar} defaultColor="hsl(var(--primary))" />
            ) : (
              <EmptyState icon="∅" description="暂无平台数据" />
            )}
          </div>
        </div>
      )}

      {/* 失败原因 TOP5 */}
      {!loading && errorGroups.length > 0 && (
        <div className="card p-4">
          <h3 className="eyebrow mb-3">top_failures</h3>
          <div className="space-y-1">
            {errorGroups.map(([msg, cnt]) => (
              <div key={msg} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-destructive font-mono shrink-0 w-8">×{cnt}</span>
                <span className="text-muted-foreground truncate">{msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 筛选 */}
      {!loading && logs.length > 0 && (
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex gap-1.5">
            {[
              ["", "全部"],
              ["SUCCESS", "成功"],
              ["FAILED", "失败"],
              ["PENDING", "待处理"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`badge cursor-pointer ${
                  statusFilter === v
                    ? v === "" ? "bg-primary/20 text-primary border border-primary/40"
                      : v === "SUCCESS" ? "bg-success/20 text-success border border-success/40"
                      : v === "FAILED" ? "bg-destructive/20 text-destructive border border-destructive/40"
                      : "bg-warning/20 text-warning border border-warning/40"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >{label}</button>
            ))}
          </div>
          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="input-field w-56"
          >
            <option value="">all_platforms</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>{PLATFORM_LABELS[t.platform] || t.platform} · {t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 历史记录（按天分组） */}
      {!projectId ? (
        <EmptyState icon="◎" title="选择项目" description="先在右上角选择一个项目" />
      ) : loading ? (
        <SkeletonTable rows={10} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          icon="📤"
          title="还没有分发记录"
          description="审核通过内容后,可在分发中心触发跨平台发布"
        />
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([day, items]) => (
            <div key={day}>
              <div className="eyebrow mb-2 sticky top-0 bg-background/80 backdrop-blur py-1">{day} <span className="text-muted-foreground">({items.length} 条)</span></div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left p-3">platform</th>
                      <th className="text-left p-3">target</th>
                      <th className="text-left p-3">content</th>
                      <th className="text-left p-3">status</th>
                      <th className="text-left p-3">time</th>
                      <th className="text-left p-3">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(log => (
                      <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3">
                          <span className="text-sm">{PLATFORM_LABELS[log.target.platform] || log.target.platform}</span>
                        </td>
                        <td className="p-3 font-medium">{log.target.name}</td>
                        <td className="p-3 max-w-xs truncate text-sm">
                          {log.draft?.title || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3">
                          <span className={`badge ${STATUS_COLOR[log.status] || ""}`}>
                            {log.status.toLowerCase()}
                          </span>
                          {log.attempts > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">×{log.attempts}</span>
                          )}
                        </td>
                        <td className="p-3 mono-line text-xs text-muted-foreground">
                          {new Date(log.sentAt || log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-3 space-x-1">
                          {log.externalUrl && (
                            <a href={log.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                              view →
                            </a>
                          )}
                          {log.status === "FAILED" && log.draftId && (
                            <button
                              onClick={() => void retryLog(log)}
                              disabled={retryingId === log.id}
                              className="btn-ghost btn-sm"
                            >
                              {retryingId === log.id ? "..." : "retry"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
