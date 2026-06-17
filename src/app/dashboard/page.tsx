"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { QuickAction, QuickActionGrid } from "@/components/ui/QuickAction";
import { DashboardSection, MiniChart, ScoreRing } from "@/components/ui/DashboardWidgets";
import { SystemHealthWidget } from "@/components/dashboard/SystemHealthWidget";

interface AuditStats {
  total: number;
  avgScore: number;
  highFindings: number;
  pendingTasks: number;
  llmCostThisMonth: number;
  geo: {
    score: number;
    trend: "up" | "down" | "stable";
    totalQuestions: number;
    brandMentioned: number;
  };
  recent: Array<{
    id: string;
    score: number;
    createdAt: string;
    page: { id: string; url: string; title: string | null };
  }>;
  geoTrend: Array<{ date: string; score: number }>;
  llmCostTrend: Array<{ date: string; cost: number }>;
}

interface SystemStats {
  projects: number;
  distribution: {
    total: number; success: number; failed: number; pending: number;
    successRate: number; todayCount: number;
  };
  content: {
    drafts: number; approved: number; published: number; pending: number;
  };
  tasks: {
    total: number; todo: number; doing: number; review: number; done: number;
    completionRate: number;
  };
  brandMentions: {
    total: number; positive: number; neutral: number; negative: number; last7d: number;
  };
  audits: { total: number; avgScore: number; last7d: number };
  llmCalls: { total30d: number; tokens30d: number; cost30dCents: number };
  timeline: Array<{ date: string; dist: number; geo: number; audit: number; task: number; mention: number }>;
}

function DonutCell({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <div className="text-sm font-mono tabular-nums font-semibold" style={{ color }}>{pct}%</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [stats, setStats] = useState<AuditStats | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [dashRes, sysRes] = await Promise.all([
        fetch("/api/dashboard/summary").then(r => r.ok ? r.json() : null),
        fetch("/api/dashboard/system-stats").then(r => r.ok ? r.json() : null),
      ]);
      if (cancelled) return;
      setStats(dashRes?.data ?? null);
      setSystemStats(sysRes?.data ?? null);
      setLoading(false);
    }
    void load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [projectId]);

  const mockGeoTrend = stats?.geoTrend?.slice(-7).map(d => d.score) || [];
  const mockCostTrend = (stats?.llmCostTrend?.slice(-7).map(d => d.cost) ?? []).map(v => v * 10);

  // 品牌提及情感百分比
  const sentiments = systemStats?.brandMentions;
  const total = (sentiments?.positive ?? 0) + (sentiments?.neutral ?? 0) + (sentiments?.negative ?? 0);
  const posPct = total > 0 ? Math.round((sentiments!.positive / total) * 100) : 0;
  const neuPct = total > 0 ? Math.round((sentiments!.neutral / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((sentiments!.negative / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* 页头 */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M01 — CONTROL CENTER</div>
          <h1 className="mt-2">控制台</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="status-dot online" />
              <span>{session?.user?.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 系统健康 */}
      <SystemHealthWidget />

      {/* 核心指标 */}
      <DashboardSection eyebrow="// CORE METRICS">
        <StatGrid cols={4}>
          <StatCard
            label="GEO 评分"
            value={loading ? "—" : (stats?.geo.score ?? 0)}
            suffix="/100"
            trend={stats?.geo.trend}
            trendValue={stats?.geo.trend === "up" ? "+8" : stats?.geo.trend === "down" ? "-3" : "0"}
            progress={stats?.geo.score}
            className="col-span-1"
          />
          <StatCard
            label="SEO 均分"
            value={loading ? "—" : (stats?.avgScore ?? 0)}
            suffix="/100"
            progress={stats?.avgScore}
            className="col-span-1"
          />
          <StatCard
            label="待办任务"
            value={loading ? "—" : (stats?.pendingTasks ?? 0)}
            badge={`${stats?.highFindings ?? 0} 高优`}
            badgeVariant={stats?.highFindings ? "error" : "default"}
            className="col-span-1"
          />
          <StatCard
            label="本月 LLM 成本"
            value={loading ? "—" : `¥${(stats?.llmCostThisMonth ?? 0).toFixed(2)}`}
            className="col-span-1"
          />
        </StatGrid>
      </DashboardSection>

      {/* 业务面板：分发 + 内容 + 任务 + 品牌 */}
      <DashboardSection eyebrow="// OPERATIONS">
        <div className="grid grid-cols-4 gap-px bg-border">
          {/* 分发 */}
          <div className="bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow">distribution</div>
              <Link href="/content/distribution/history" className="text-[10px] text-primary hover:underline">→</Link>
            </div>
            <div className="text-3xl font-light tabular-nums">{systemStats?.distribution.total ?? 0}</div>
            <div className="text-[10px] font-mono text-muted-foreground">总分发数 · 今日 {systemStats?.distribution.todayCount ?? 0}</div>
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/50">
              <div>
                <div className="text-[10px] text-success font-mono">✓ {systemStats?.distribution.success ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-destructive font-mono">✗ {systemStats?.distribution.failed ?? 0}</div>
              </div>
              <div>
                <div className="text-[10px] text-warning font-mono">⧗ {systemStats?.distribution.pending ?? 0}</div>
              </div>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                <span>success_rate</span>
                <span className="tabular-nums">{systemStats?.distribution.successRate ?? 0}%</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success transition-all duration-700"
                  style={{ width: `${systemStats?.distribution.successRate ?? 0}%` }} />
              </div>
            </div>
          </div>

          {/* 内容 */}
          <div className="bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow">content</div>
              <Link href="/content/drafts" className="text-[10px] text-primary hover:underline">→</Link>
            </div>
            <div className="text-3xl font-light tabular-nums">{systemStats?.content.drafts ?? 0}</div>
            <div className="text-[10px] font-mono text-muted-foreground">总草稿数 · {systemStats?.content.published ?? 0} 已发布</div>
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/50">
              <div>
                <div className="text-[10px] font-mono">✓ {systemStats?.content.approved ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">已批准</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-primary">↗ {systemStats?.content.published ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">已发布</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-warning">⧗ {systemStats?.content.pending ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">待处理</div>
              </div>
            </div>
          </div>

          {/* 任务 */}
          <div className="bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow">tasks</div>
              <Link href="/tasks/board" className="text-[10px] text-primary hover:underline">→</Link>
            </div>
            <div className="text-3xl font-light tabular-nums">{systemStats?.tasks.total ?? 0}</div>
            <div className="text-[10px] font-mono text-muted-foreground">完成任务 {systemStats?.tasks.done ?? 0} · 完成率 {systemStats?.tasks.completionRate ?? 0}%</div>
            <div className="grid grid-cols-4 gap-1 pt-2 border-t border-border/50">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground">{systemStats?.tasks.todo ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">TODO</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-info">{systemStats?.tasks.doing ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">DOING</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-primary">{systemStats?.tasks.review ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">REVIEW</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-success">{systemStats?.tasks.done ?? 0}</div>
                <div className="text-[9px] text-muted-foreground">DONE</div>
              </div>
            </div>
          </div>

          {/* 品牌提及 */}
          <div className="bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="eyebrow">brand_mentions</div>
              <Link href="/brand/monitor" className="text-[10px] text-primary hover:underline">→</Link>
            </div>
            <div className="text-3xl font-light tabular-nums">{systemStats?.brandMentions.total ?? 0}</div>
            <div className="text-[10px] font-mono text-muted-foreground">近 7 天新增 {systemStats?.brandMentions.last7d ?? 0}</div>
            <div className="flex items-center justify-around pt-2 border-t border-border/50">
              <DonutCell pct={posPct} color="hsl(var(--success))" label="正面" />
              <DonutCell pct={neuPct} color="hsl(var(--muted-foreground))" label="中性" />
              <DonutCell pct={negPct} color="hsl(var(--destructive))" label="负面" />
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* 趋势 + 活动时间线 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 7天活动时间线 */}
        <DashboardSection eyebrow="// ACTIVITY · 7D" title="活动时间线" className="col-span-2">
          <div className="space-y-3">
            {(systemStats?.timeline ?? []).map((day, i) => {
              const max = Math.max(1, ...(systemStats?.timeline ?? []).map(d => d.geo + d.dist + d.audit + d.task + d.mention));
              const total = day.geo + day.dist + day.audit + day.task + day.mention;
              const w = (total / max) * 100;
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground tabular-nums">{day.date.slice(5)}</span>
                    <span className="tabular-nums">{total} 事件</span>
                  </div>
                  <div className="flex h-3 bg-muted rounded overflow-hidden">
                    <div className="bg-success" style={{ width: `${(day.geo / Math.max(total,1)) * w}%` }} title={`GEO ${day.geo}`} />
                    <div className="bg-primary" style={{ width: `${(day.dist / Math.max(total,1)) * w}%` }} title={`分发 ${day.dist}`} />
                    <div className="bg-warning" style={{ width: `${(day.audit / Math.max(total,1)) * w}%` }} title={`审计 ${day.audit}`} />
                    <div className="bg-info" style={{ width: `${(day.task / Math.max(total,1)) * w}%` }} title={`任务 ${day.task}`} />
                    <div className="bg-purple-500" style={{ width: `${(day.mention / Math.max(total,1)) * w}%` }} title={`提及 ${day.mention}`} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-3 border-t border-border text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-success" />GEO</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary" />分发</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-warning" />审计</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-info" />任务</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500" />提及</span>
            </div>
          </div>
        </DashboardSection>

        {/* 趋势图 */}
        <DashboardSection eyebrow="// TRENDS" title="GEO + LLM 趋势" className="col-span-1">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">GEO 评分</span>
                <ScoreRing score={stats?.geo.score ?? 0} size={32} strokeWidth={2} />
              </div>
              <MiniChart data={mockGeoTrend.length > 0 ? mockGeoTrend : [0]} color="success" height={48} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">LLM 成本</span>
                <span className="text-sm font-mono tabular-nums">¥{(stats?.llmCostThisMonth ?? 0).toFixed(2)}</span>
              </div>
              <MiniChart data={mockCostTrend.length > 0 ? mockCostTrend : [0]} color="warning" height={48} />
            </div>
            <div className="pt-3 border-t border-border text-[10px] font-mono text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>LLM calls · 30d</span><span className="tabular-nums">{systemStats?.llmCalls.total30d ?? 0}</span></div>
              <div className="flex justify-between"><span>Tokens · 30d</span><span className="tabular-nums">{(systemStats?.llmCalls.tokens30d ?? 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Cost · 30d</span><span className="tabular-nums">¥{((systemStats?.llmCalls.cost30dCents ?? 0) / 100).toFixed(2)}</span></div>
            </div>
          </div>
        </DashboardSection>
      </div>

      {/* 最近诊断 + 快捷入口 */}
      <div className="grid grid-cols-3 gap-6">
        <DashboardSection eyebrow="// RECENT AUDITS" title="最近诊断" className="col-span-2">
          <div className="space-y-2">
            {loading ? (
              <div className="text-muted-foreground font-mono text-xs">加载中...</div>
            ) : stats?.recent && stats.recent.length > 0 ? (
              stats.recent.slice(0, 5).map((audit) => (
                <Link
                  key={audit.id}
                  href={`/audits/${audit.id}`}
                  className="flex items-center justify-between p-3 border border-border hover:border-primary/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate group-hover:text-primary transition-colors">
                      {audit.page.title || audit.page.url}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {new Date(audit.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ScoreRing score={audit.score} size={36} strokeWidth={2} />
                </Link>
              ))
            ) : (
              <div className="text-muted-foreground font-mono text-xs text-center py-8">
                暂无诊断记录
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link href="/audits" className="btn-ghost btn-sm">查看全部 →</Link>
          </div>
        </DashboardSection>

        <DashboardSection eyebrow="// QUICK ACCESS" title="快捷入口" className="col-span-1">
          <QuickActionGrid cols={1}>
            <QuickAction title="页面诊断" description="对网站页面进行 SEO 诊断" icon="🔍" href="/audits" />
            <QuickAction title="关键词管理" description="管理跟踪的关键词" icon="📊" href="/keywords" />
            <QuickAction title="GEO 监测" description="AI 搜索引擎表现监测" icon="🤖" href="/geo" />
            <QuickAction title="任务看板" description="可视化任务管理" icon="📋" href="/tasks/board" />
            <QuickAction title="分发历史" description="查看所有分发记录" icon="📤" href="/content/distribution/history" />
          </QuickActionGrid>
        </DashboardSection>
      </div>
    </div>
  );
}
