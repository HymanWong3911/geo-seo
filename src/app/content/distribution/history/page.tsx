"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";

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
  SUCCESS: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  PENDING: "bg-warning/10 text-warning",
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

  async function load(silent = false) {
    if (!projectId) { setLogs([]); setTargets([]); setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [logsRes, targetsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/distribution-logs?limit=200`),
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
  }

  useEffect(() => { void load(); }, [projectId]);

  // 时间筛选
  const rangedLogs = useMemo(() => {
    const cutoff = timeRangeCutoff(timeRange);
    if (!cutoff) return logs;
    return logs.filter(l => {
      const t = l.sentAt || l.createdAt;
      return new Date(t).getTime() >= cutoff.getTime();
    });
  }, [logs, timeRange]);

  // 状态/平台筛选
  const filteredLogs = useMemo(() => rangedLogs.filter(l => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (platformFilter && l.targetId !== platformFilter) return false;
    return true;
  }), [rangedLogs, statusFilter, platformFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: rangedLogs.length,
    success: rangedLogs.filter(l => l.status === "SUCCESS").length,
    failed: rangedLogs.filter(l => l.status === "FAILED").length,
    pending: rangedLogs.filter(l => l.status === "PENDING").length,
    successRate: rangedLogs.length > 0 ? Math.round((rangedLogs.filter(l => l.status === "SUCCESS").length / rangedLogs.length) * 100) : 0,
  }), [rangedLogs]);

  // 平台统计
  const platformStats = useMemo(() => targets.map(t => {
    const arr = rangedLogs.filter(l => l.targetId === t.id);
    return {
      ...t,
      total: arr.length,
      success: arr.filter(l => l.status === "SUCCESS").length,
      failed: arr.filter(l => l.status === "FAILED").length,
    };
  }).filter(t => t.total > 0).sort((a, b) => b.total - a.total), [targets, rangedLogs]);

  // 失败原因聚合
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

  // 按天分组
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, DistributionLog[]>();
    for (const l of filteredLogs) {
      const d = new Date(l.sentAt || l.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l);
    }
    return Array.from(groups.entries());
  }, [filteredLogs]);

  async function retryLog(log: DistributionLog) {
    if (!log.draftId) return;
    setRetryingId(log.id);
    try {
      await fetch(`/api/drafts/${log.draftId}/batch-distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetIds: [log.targetId] }),
      });
      await load(true);
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 页头 */}
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
      <div className="flex gap-2">
        {([
          ["today", "今日"],
          ["7d", "近 7 天"],
          ["30d", "近 30 天"],
          ["all", "全部"],
        ] as Array<[TimeRange, string]>).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTimeRange(v)}
            className={`badge cursor-pointer ${timeRange === v ? "badge-primary" : "badge-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 统计卡片 */}
      {!loading && rangedLogs.length > 0 && (
        <div className="grid grid-cols-5 gap-px bg-border">
          <div className="cell">
            <div className="eyebrow">total</div>
            <div className="metric-number-sm mt-1">{stats.total}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">success</div>
            <div className="metric-number-sm mt-1 text-success">{stats.success}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">failed</div>
            <div className="metric-number-sm mt-1 text-destructive">{stats.failed}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">pending</div>
            <div className="metric-number-sm mt-1 text-warning">{stats.pending}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">success_rate</div>
            <div className="metric-number-sm mt-1">{stats.successRate}%</div>
          </div>
        </div>
      )}

      {/* 平台统计 */}
      {!loading && platformStats.length > 0 && (
        <div className="card p-4">
          <h3 className="eyebrow mb-3">by_platform</h3>
          <div className="flex flex-wrap gap-4">
            {platformStats.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-sm">{PLATFORM_LABELS[t.platform] || t.platform}</span>
                <span className="badge badge-muted">{t.total}</span>
                <span className="text-xs text-success">{t.success} ✓</span>
                {t.failed > 0 && <span className="text-xs text-destructive">{t.failed} ✗</span>}
              </div>
            ))}
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
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input-field w-40"
          >
            <option value="">all_status</option>
            <option value="SUCCESS">success</option>
            <option value="FAILED">failed</option>
            <option value="PENDING">pending</option>
          </select>
          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="input-field w-48"
          >
            <option value="">all_platforms</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.platform})</option>
            ))}
          </select>
        </div>
      )}

      {/* 历史记录（按天分组） */}
      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : loading ? (
        <SkeletonTable rows={10} />
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          [ no_distribution_logs ] — 当前筛选条件下无数据
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([day, items]) => (
            <div key={day}>
              <div className="eyebrow mb-2 sticky top-0 bg-background/80 backdrop-blur py-1">{day} <span className="text-muted-foreground">({items.length} 条)</span></div>
              <div className="border border-border">
                <table>
                  <thead>
                    <tr>
                      <th>platform</th>
                      <th>target</th>
                      <th>content</th>
                      <th>status</th>
                      <th>time</th>
                      <th>actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(log => (
                      <tr key={log.id}>
                        <td>
                          <span className="text-sm">{PLATFORM_LABELS[log.target.platform] || log.target.platform}</span>
                        </td>
                        <td className="font-medium">{log.target.name}</td>
                        <td className="max-w-xs truncate text-sm">
                          {log.draft?.title || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_COLOR[log.status] || ""}`}>
                            {log.status.toLowerCase()}
                          </span>
                          {log.attempts > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">×{log.attempts}</span>
                          )}
                        </td>
                        <td className="mono-line text-xs text-muted-foreground">
                          {new Date(log.sentAt || log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="space-x-1">
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
