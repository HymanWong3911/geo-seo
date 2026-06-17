"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { QuickAction, QuickActionGrid } from "@/components/ui/QuickAction";
import { DashboardSection, MiniChart, ScoreRing } from "@/components/ui/DashboardWidgets";

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

export default function DashboardPage() {
  const { data: session } = useSession();
  const { t } = useI18n();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/dashboard/summary");
      if (res.ok) {
        const json = await res.json();
        setStats(json.data);
      }
      setLoading(false);
    })();
  }, []);

  // 生成模拟趋势数据用于展示
  const mockGeoTrend = stats?.geoTrend?.slice(-7).map(d => d.score) || [40, 42, 45, 43, 48, 50, 52];
  const mockCostTrend = stats?.llmCostTrend?.slice(-7).map(d => d.cost) || [1.2, 1.5, 1.3, 1.8, 1.6, 1.4, 1.7];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* === 页头 === */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M01 — CONTROL CENTER</div>
          <h1 className="mt-2">控制台</h1>
        </div>
        <div className="page-header-right">
          <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="status-dot online" />
              <span>SYSTEM · ONLINE</span>
            </div>
            <div className="text-foreground">{session?.user?.email}</div>
          </div>
        </div>
      </header>

      {/* === 核心指标 === */}
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

      {/* === 趋势图表 === */}
      <DashboardSection eyebrow="// TRENDS · 30D" title="数据趋势">
        <div className="grid grid-cols-2 gap-6">
          {/* GEO 评分趋势 */}
          <div className="chart-container">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="eyebrow mb-1">GEO 评分趋势</div>
                <ScoreRing score={stats?.geo.score ?? 0} size={48} strokeWidth={3} />
              </div>
              <div className="text-right">
                <div className="text-2xl font-light tabular-nums">
                  {stats?.geo.score ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats?.geo.totalQuestions ?? 0} 个问题 · {stats?.geo.brandMentioned ?? 0} 次提及
                </div>
              </div>
            </div>
            <MiniChart data={mockGeoTrend} color="success" height={64} />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>7天前</span>
              <span>今天</span>
            </div>
          </div>

          {/* LLM 成本趋势 */}
          <div className="chart-container">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="eyebrow mb-1">LLM 成本</div>
                <div className="text-2xl font-light tabular-nums">
                  ¥{(stats?.llmCostThisMonth ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">本月累计</div>
              </div>
            </div>
            <MiniChart data={mockCostTrend.map(v => v * 10)} color="warning" height={64} />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>7天前</span>
              <span>今天</span>
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* === 最近诊断 + 快捷入口 === */}
      <div className="grid grid-cols-3 gap-6">
        {/* 最近诊断 */}
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
            <Link href="/audits" className="btn-ghost btn-sm">
              查看全部 →
            </Link>
          </div>
        </DashboardSection>

        {/* 快捷入口 */}
        <DashboardSection eyebrow="// QUICK ACCESS" title="快捷入口" className="col-span-1">
          <QuickActionGrid cols={1}>
            <QuickAction
              title="页面诊断"
              description="对网站页面进行 SEO 诊断"
              icon="🔍"
              href="/audits"
            />
            <QuickAction
              title="关键词管理"
              description="管理跟踪的关键词"
              icon="📊"
              href="/keywords"
            />
            <QuickAction
              title="GEO 监测"
              description="AI 搜索引擎表现监测"
              icon="🤖"
              href="/geo"
            />
            <QuickAction
              title="任务看板"
              description="可视化任务管理"
              icon="📋"
              href="/tasks/board"
            />
          </QuickActionGrid>
        </DashboardSection>
      </div>
    </div>
  );
}
