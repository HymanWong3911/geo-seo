"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { MiniChart, ScoreRing } from "@/components/ui/DashboardWidgets";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { DashboardSection } from "@/components/ui/DashboardWidgets";
import { cn } from "@/lib/utils";

interface LLMStats {
  range: { since: string; days: number; projectId: string | null };
  totals: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number | string;
    avgDurationMs: number;
  };
  grouped: Array<{
    [k: string]: unknown;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number | string;
    avgDurationMs: number;
  }>;
  daily: Array<{ day: string; calls: number; tokens: number; cost: number }>;
  recent: Array<{
    id: string;
    jobType: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number | string;
    durationMs: number;
    success: boolean;
    createdAt: string;
  }>;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  "real-search": "🔍 真实搜索",
  "llm-fallback": "🔁 LLM 兜底",
  "geo-analysis": "🤖 GEO 分析",
  "content-analysis": "📊 内容分析",
  "report-generation": "📑 报告生成",
  "keyword-expand": "🔑 关键词扩展",
  "draft-generate": "✍️ 草稿生成",
  "draft-rewrite": "🔄 草稿重写",
  "brand-monitor": "📡 品牌监控",
  "integration-test": "🧪 集成测试",
};

export default function LLMUsagePage() {
  const [stats, setStats] = useState<LLMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [groupBy, setGroupBy] = useState<"provider" | "jobType" | "day" | "model">("provider");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/llm/stats?days=${days}&groupBy=${groupBy}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setStats(json.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [days, groupBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="// LLM 用量"
        title={"LLM 用量统计"}
        description={"真实渠道调用、用量、成本与分布"}
      >
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="text-xs bg-background border border-border rounded px-2 py-1 font-mono"
          >
            <option value="1">最近 1 天</option>
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
            <option value="90">最近 90 天</option>
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
            className="text-xs bg-background border border-border rounded px-2 py-1 font-mono"
          >
            <option value="provider">按 provider</option>
            <option value="jobType">按 jobType</option>
            <option value="model">按 model</option>
            <option value="day">按 day</option>
          </select>
        </div>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : stats ? (
        <>
          {/* 顶部统计 */}
          <StatGrid cols={4}>
            <StatCard
              label="总调用数"
              value={stats.totals.calls}
              trend={stats.totals.calls > 0 ? "up" : "stable"}
              trendValue={`${days}d`}
            />
            <StatCard
              label="总 Tokens"
              value={formatNumber(stats.totals.totalTokens)}
              suffix={`(${stats.totals.promptTokens}/${stats.totals.completionTokens})`}
            />
            <StatCard
              label="总成本"
              value={formatCost(stats.totals.costCents)}
              progress={Math.min(100, Math.round((parseFloat(String(stats.totals.costCents)) / 100) * 100))}
            />
            <StatCard
              label="平均耗时"
              value={`${stats.totals.avgDurationMs}`}
              suffix="ms"
              trend={stats.totals.avgDurationMs < 10000 ? "up" : "down"}
              trendValue={stats.totals.avgDurationMs < 10000 ? "good" : "slow"}
            />
          </StatGrid>

          {/* 每日时间线 */}
          <DashboardSection eyebrow="// 每日趋势">
            <div className="border border-border bg-card rounded-lg p-4">
              <div className="text-[10px] font-mono text-muted-foreground mb-3">
                {stats.daily.length} 天 · {stats.daily.reduce((s, d) => s + d.calls, 0)} 次调用
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">tokens / day</div>
                  <MiniChart
                    data={stats.daily.slice().reverse().map(d => d.tokens)}
                    color="info"
                    height={60}
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                    <span>{stats.daily[stats.daily.length - 1]?.day ?? ""}</span>
                    <span>{stats.daily[0]?.day ?? ""}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">cost / day (cents)</div>
                  <MiniChart
                    data={stats.daily.slice().reverse().map(d => d.cost)}
                    color="warning"
                    height={60}
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                    <span>¥{((stats.daily[stats.daily.length - 1]?.cost ?? 0) / 100).toFixed(2)}</span>
                    <span>¥{(stats.daily[0]?.cost / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </DashboardSection>

          {/* 分组统计 */}
          <DashboardSection eyebrow={`// BY ${groupBy.toUpperCase()}`}>
            <div className="border border-border bg-card rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] font-mono uppercase text-muted-foreground">
                    <th className="text-left p-3">{groupBy}</th>
                    <th className="text-right p-3">calls</th>
                    <th className="text-right p-3">prompt</th>
                    <th className="text-right p-3">completion</th>
                    <th className="text-right p-3">total</th>
                    <th className="text-right p-3">cost</th>
                    <th className="text-right p-3">avg ms</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.grouped.map((g, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-xs">
                        {groupBy === "jobType"
                          ? (JOB_TYPE_LABEL[String(g.jobType)] ?? String(g.jobType))
                          : String(g[groupBy] ?? "?")}
                      </td>
                      <td className="p-3 text-right tabular-nums">{g.calls}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{formatNumber(g.promptTokens)}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{formatNumber(g.completionTokens)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold">{formatNumber(g.totalTokens)}</td>
                      <td className="p-3 text-right tabular-nums text-warning">{formatCost(g.costCents)}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{g.avgDurationMs}</td>
                    </tr>
                  ))}
                  {stats.grouped.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground text-xs">
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DashboardSection>

          {/* 最近调用 */}
          <DashboardSection eyebrow="// 最近调用">
            <div className="border border-border bg-card rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] font-mono uppercase text-muted-foreground">
                    <th className="text-left p-3">时间</th>
                    <th className="text-left p-3">类型</th>
                    <th className="text-left p-3">provider</th>
                    <th className="text-left p-3">model</th>
                    <th className="text-right p-3">tokens</th>
                    <th className="text-right p-3">cost</th>
                    <th className="text-right p-3">耗时</th>
                    <th className="text-center p-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((c) => (
                    <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString("zh-CN", { hour12: false })}
                      </td>
                      <td className="p-3 text-xs">
                        {JOB_TYPE_LABEL[c.jobType] ?? c.jobType}
                      </td>
                      <td className="p-3 font-mono text-xs">{c.provider}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                        {c.model}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">
                        {c.totalTokens.toLocaleString()}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs text-warning">
                        {formatCost(c.costCents)}
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs text-muted-foreground">
                        {c.durationMs}ms
                      </td>
                      <td className="p-3 text-center">
                        <span className={cn(
                          "inline-block px-1.5 py-0.5 text-[10px] font-mono rounded",
                          c.success
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {c.success ? "✓" : "✗"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stats.recent.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground text-xs">
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DashboardSection>
        </>
      ) : (
        <div className="text-center text-muted-foreground text-sm py-12">
          加载失败
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cents: number | string): string {
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  return `¥${(n / 100).toFixed(2)}`;
}
