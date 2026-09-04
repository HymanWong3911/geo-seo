"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { DashboardSection } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface InsightItem {
  title: string;
  rationale: string;
  metric?: string;
  href?: string;
}

interface ActionItem extends InsightItem {
  steps: string[];
  priority: "P0" | "P1" | "P2";
}

interface ProjectInsights {
  projectId: string;
  generatedAt: string;
  cachedUntil: string;
  source: "llm" | "heuristic";
  headline: string;
  summary: string;
  opportunities: InsightItem[];
  threats: InsightItem[];
  actions: ActionItem[];
  stats: {
    audits: number;
    avgScore: number;
    lowScorePages: number;
    geoRuns: number;
    geoSuccessRate: number;
    mentions: number;
    negativeMentions: number;
    distributionSuccessRate: number;
    pendingDrafts: number;
  };
}

interface Project {
  id: string;
  name: string;
  domain: string;
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  P0: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", ring: "ring-red-200 dark:ring-red-900/50" },
  P1: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900/50" },
  P2: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300", ring: "ring-sky-200 dark:ring-sky-900/50" },
};

function PriorityBadge({ p }: { p: ActionItem["priority"] }) {
  const s = PRIORITY_STYLE[p] ?? PRIORITY_STYLE.P2;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.bg, s.text, s.ring)}>
      {p}
    </span>
  );
}

function InsightCard({ item, kind }: { item: InsightItem; kind: "opp" | "threat" }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm leading-snug">
          {kind === "opp" ? "🎯 " : "⚠️ "}
          {item.title}
        </h3>
        {item.metric && (
          <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-600 dark:text-slate-400">
            {item.metric}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.rationale}</p>
      {item.href && (
        <Link href={item.href} className="mt-3 inline-block text-xs text-sky-600 dark:text-sky-400 hover:underline">
          打开详情 →
        </Link>
      )}
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start gap-3">
        <PriorityBadge p={item.priority} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm leading-snug">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.rationale}</p>
        </div>
      </div>
      {item.steps.length > 0 && (
        <ol className="mt-3 space-y-1.5 pl-1">
          {item.steps.map((s, i) => (
            <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex gap-2">
              <span className="shrink-0 font-mono text-slate-400">{i + 1}.</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {item.href && (
        <Link href={item.href} className="mt-3 inline-block text-xs text-sky-600 dark:text-sky-400 hover:underline">
          打开详情 →
        </Link>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") ?? "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectIdFromUrl);
  const [insights, setInsights] = useState<ProjectInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/projects?pageSize=50");
      if (r.ok) {
        const j = await r.json();
        const list: Project[] = j.data ?? [];
        setProjects(list);
        setSelectedProject((current) => current || list[0]?.id || "");
      }
    })();
  }, []);

  const load = useCallback(async (forceRefresh: boolean) => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/projects/${selectedProject}/insights`, window.location.origin);
      if (forceRefresh) url.searchParams.set("refresh", "1");
      const r = await fetch(url);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setInsights(j.data);
    } catch (e: any) {
      setError(e.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (selectedProject) void load(false);
  }, [selectedProject, load]);

  const sourceBadge = useMemo(() => {
    if (!insights) return null;
    return insights.source === "llm"
      ? { label: "🤖 LLM 洞察", color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" }
      : { label: "📊 启发式洞察", color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" };
  }, [insights]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PageHeader
        eyebrow="// AI INSIGHTS"
        title="AI 洞察"
        description="基于项目最近 7 天的真实数据(审计 / GEO / 品牌监控 / 分发),系统自动分析当前的机会、风险和推荐行动"
        actions={
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              ← 仪表盘
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* 项目选择 + 刷新 */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">项目</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="flex-1 max-w-md rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">选择项目…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.domain})
              </option>
            ))}
          </select>
          {insights && sourceBadge && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", sourceBadge.color)}>
              {sourceBadge.label}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || !selectedProject}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {refreshing ? "生成中…" : "🔄 重新生成"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && !insights && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {insights && (
          <>
            {/* 头条 + 摘要 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 to-violet-50 dark:from-sky-950/30 dark:to-violet-950/30 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{insights.headline}</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insights.summary}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>生成于 {new Date(insights.generatedAt).toLocaleString("zh-CN")}</span>
                <span>•</span>
                <span>缓存至 {new Date(insights.cachedUntil).toLocaleString("zh-CN")}</span>
              </div>
            </div>

            {/* 统计 */}
            <StatGrid>
              <StatCard
                title="SEO 均分"
                value={insights.stats.avgScore}
                unit="/100"
                accent={insights.stats.avgScore >= 70 ? "good" : insights.stats.avgScore >= 50 ? "warn" : "bad"}
              />
              <StatCard
                title="审计次数"
                value={insights.stats.audits}
                subtext={`低分页 ${insights.stats.lowScorePages}`}
              />
              <StatCard
                title="GEO 成功率"
                value={`${insights.stats.geoSuccessRate}%`}
                subtext={`共 ${insights.stats.geoRuns} 次`}
                accent={insights.stats.geoSuccessRate >= 80 ? "good" : insights.stats.geoSuccessRate >= 50 ? "warn" : "bad"}
              />
              <StatCard
                title="负面提及"
                value={insights.stats.negativeMentions}
                subtext={`共 ${insights.stats.mentions} 条`}
                accent={insights.stats.negativeMentions > 0 ? "bad" : "good"}
              />
              <StatCard
                title="分发成功率"
                value={`${insights.stats.distributionSuccessRate}%`}
                accent={insights.stats.distributionSuccessRate >= 80 ? "good" : insights.stats.distributionSuccessRate >= 50 ? "warn" : "bad"}
              />
              <StatCard title="待审稿" value={insights.stats.pendingDrafts} accent={insights.stats.pendingDrafts > 5 ? "bad" : "neutral"} />
            </StatGrid>

            {/* 机会 */}
            <DashboardSection
              title="🎯 机会"
              description="可以立即着手的改进点"
            >
              {insights.opportunities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                  当前没有发现明显的优化机会
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {insights.opportunities.map((o, i) => (
                    <InsightCard key={i} item={o} kind="opp" />
                  ))}
                </div>
              )}
            </DashboardSection>

            {/* 威胁 */}
            <DashboardSection
              title="⚠️ 风险"
              description="需要关注的潜在问题"
            >
              {insights.threats.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                  ✅ 当前没有发现明显风险
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {insights.threats.map((t, i) => (
                    <InsightCard key={i} item={t} kind="threat" />
                  ))}
                </div>
              )}
            </DashboardSection>

            {/* 行动 */}
            <DashboardSection
              title="✅ 推荐行动"
              description="按优先级排序的可执行任务"
            >
              {insights.actions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500">
                  暂无推荐行动
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {insights.actions.map((a, i) => (
                    <ActionCard key={i} item={a} />
                  ))}
                </div>
              )}
            </DashboardSection>

            {/* 帮助 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-xs text-slate-500 dark:text-slate-400">
              <p>
                💡 <strong>关于洞察来源</strong>:系统优先调用 LLM (ARK) 基于真实业务数据生成洞察,缓存 24 小时。
                如果 LLM 不可用,自动降级到规则启发式洞察,保证总能给出可执行建议。
                点击"重新生成"会强制刷新缓存。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
