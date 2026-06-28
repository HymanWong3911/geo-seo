"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { DashboardSection, MiniChart } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

interface GeoRunDetail {
  id: string;
  status: string;
  provider: string;
  model: string;
  triggerType: string;
  questionIds: string[];
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  project: { id: string; name: string; primaryBrand: string | null };
  results: Array<{
    id: string;
    answer: string;
    providerSource: string;
    providerAttempts: number;
    citedUrls: string[];
    mentionedBrands: string[];
    mentionedCompetitors: string[];
    primaryBrandMentioned: boolean;
    primaryBrandRecommended: boolean;
    sentiment: string | null;
    position: number | null;
    links: string[];
    analysis: any;
    createdAt: string;
    geoQuestion: { id: string; question: string };
  }>;
}

const SENTIMENT_STYLES: Record<string, string> = {
  POSITIVE: "border-success/30 bg-success/10 text-success",
  NEUTRAL: "border-muted bg-muted/30 text-muted-foreground",
  NEGATIVE: "border-destructive/30 bg-destructive/10 text-destructive",
  MIXED: "border-warning/30 bg-warning/10 text-warning",
};

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "border-success/30 bg-success/10 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  RUNNING: "border-info/30 bg-info/10 text-info",
  PARTIAL_FAILURE: "border-warning/30 bg-warning/10 text-warning",
};

function BrandBadge({ mentioned, recommended, primary }: { mentioned: boolean; recommended: boolean; primary: string | null }) {
  if (recommended) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        🌟 推荐 {primary ? `(${primary})` : ""}
      </span>
    );
  }
  if (mentioned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
        💬 提及 {primary ? `(${primary})` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      — 未提及
    </span>
  );
}

export default function GeoRunDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [run, setRun] = useState<GeoRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geo/runs/${params.id}`);
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setError(j?.error?.message ?? `HTTP ${r.status}`);
        } else {
          const j = await r.json();
          setRun(j.data);
        }
      } catch (e: any) {
        setError(e.message ?? "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const stats = useMemo(() => {
    if (!run) return null;
    const total = run.results.length;
    const mentioned = run.results.filter((r) => r.primaryBrandMentioned).length;
    const recommended = run.results.filter((r) => r.primaryBrandRecommended).length;
    const mentionRate = total > 0 ? Math.round((mentioned / total) * 100) : 0;
    const recommendRate = total > 0 ? Math.round((recommended / total) * 100) : 0;
    const avgPosition =
      run.results.filter((r) => typeof r.position === "number").length > 0
        ? Math.round(
            run.results
              .filter((r) => typeof r.position === "number")
              .reduce((s, r) => s + (r.position ?? 0), 0) /
              run.results.filter((r) => typeof r.position === "number").length,
          )
        : null;
    const sentiments = {
      positive: run.results.filter((r) => r.sentiment === "POSITIVE").length,
      neutral: run.results.filter((r) => r.sentiment === "NEUTRAL" || !r.sentiment).length,
      negative: run.results.filter((r) => r.sentiment === "NEGATIVE").length,
    };
    return { total, mentioned, recommended, mentionRate, recommendRate, avgPosition, sentiments };
  }, [run]);

  // 按问题分组
  const byQuestion = useMemo(() => {
    if (!run) return new Map<string, typeof run.results>();
    const m = new Map<string, typeof run.results>();
    for (const r of run.results) {
      const qid = r.geoQuestion.id;
      if (!m.has(qid)) m.set(qid, [] as any);
      m.get(qid)!.push(r as any);
    }
    return m;
  }, [run]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "未找到 GEO run"}
        </div>
        <Link href={`/geo/runs?projectId=${projectId}`} className="mt-3 inline-block text-sm text-sky-600 hover:underline">
          ← 返回运行列表
        </Link>
      </div>
    );
  }

  const elapsedMs =
    run.startedAt && run.finishedAt
      ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div>
        <Link href={`/geo/runs?projectId=${projectId}`} className="text-sm text-muted-foreground hover:underline">
          ← 返回 GEO 运行列表
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">GEO 运行详情</h1>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[run.status] ?? STATUS_STYLES.PENDING)}>
                {run.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{run.id}</span> · 触发:{run.triggerType} · Provider:{run.provider} · Model:{run.model}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              创建于 {new Date(run.createdAt).toLocaleString("zh-CN")}
              {run.startedAt && ` · 启动 ${new Date(run.startedAt).toLocaleTimeString("zh-CN")}`}
              {run.finishedAt && ` · 完成 ${new Date(run.finishedAt).toLocaleTimeString("zh-CN")}`}
              {elapsedMs && ` · 耗时 ${(elapsedMs / 1000).toFixed(1)}s`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{run.project.name}</div>
            {run.project.primaryBrand && (
              <div className="mt-1 text-sm font-medium">主品牌: {run.project.primaryBrand}</div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {run.errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="eyebrow text-destructive">error</h3>
          <p className="mt-1 text-sm font-mono">{run.errorMessage}</p>
        </div>
      )}

      {/* KPI 卡片 */}
      {stats && (
        <StatGrid>
          <StatCard
            title="总问题数"
            value={stats.total}
            subtext={`provider x 问题`}
          />
          <StatCard
            title="品牌提及率"
            value={`${stats.mentionRate}%`}
            subtext={`${stats.mentioned}/${stats.total} 次提及`}
            accent={stats.mentionRate >= 50 ? "good" : stats.mentionRate >= 25 ? "warn" : "bad"}
          />
          <StatCard
            title="品牌推荐率"
            value={`${stats.recommendRate}%`}
            subtext={`${stats.recommended}/${stats.total} 次推荐`}
            accent={stats.recommendRate >= 30 ? "good" : stats.recommendRate >= 10 ? "warn" : "bad"}
          />
          <StatCard
            title="平均位置"
            value={stats.avgPosition ?? "—"}
            subtext="position 越小越靠前"
          />
          <StatCard
            title="情感"
            value={`+${stats.sentiments.positive} / =${stats.sentiments.neutral} / -${stats.sentiments.negative}`}
            subtext="正面/中性/负面"
            accent={stats.sentiments.negative > 0 ? "warn" : "good"}
          />
        </StatGrid>
      )}

      {/* 问题分组 */}
      <DashboardSection
        title="📋 问题回答详情"
        description={`按问题分组,每个问题可能有多个 provider 的回答`}
      >
        <div className="space-y-3">
          {Array.from(byQuestion.entries()).map(([qid, results], idx) => {
            const q = results[0]?.geoQuestion?.question ?? `问题 ${idx + 1}`;
            const mentioned = results.filter((r) => r.primaryBrandMentioned).length;
            const isOpen = expanded === qid;
            return (
              <div key={qid} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpanded(isOpen ? null : qid)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {idx + 1}. {q}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                        {results.length} provider
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      品牌提及 {mentioned}/{results.length} 次
                    </div>
                  </div>
                  <span className="shrink-0 text-slate-400">{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    {results.map((r) => (
                      <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="rounded-md bg-violet-100 dark:bg-violet-950/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                            {r.providerSource}
                          </span>
                          <BrandBadge
                            mentioned={r.primaryBrandMentioned}
                            recommended={r.primaryBrandRecommended}
                            primary={run.project.primaryBrand}
                          />
                          {r.sentiment && (
                            <span className={cn("rounded-md border px-2 py-0.5 text-xs", SENTIMENT_STYLES[r.sentiment] ?? SENTIMENT_STYLES.NEUTRAL)}>
                              {r.sentiment}
                            </span>
                          )}
                          {typeof r.position === "number" && (
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600">
                              pos {r.position}
                            </span>
                          )}
                          {r.providerAttempts > 1 && (
                            <span className="rounded-md bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs text-amber-700">
                              retry {r.providerAttempts}
                            </span>
                          )}
                        </div>
                        <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {r.answer.slice(0, 600)}
                          {r.answer.length > 600 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-sky-600">展开完整回答 ({r.answer.length} 字符)</summary>
                              <div className="mt-2">{r.answer.slice(600)}</div>
                            </details>
                          )}
                        </div>
                        {(r.citedUrls.length > 0 || r.links.length > 0 || r.mentionedBrands.length > 0) && (
                          <div className="mt-3 space-y-1 border-t border-slate-200 dark:border-slate-800 pt-2 text-xs">
                            {r.citedUrls.length > 0 && (
                              <div>
                                <span className="font-mono text-muted-foreground">引用 URLs: </span>
                                {r.citedUrls.slice(0, 3).map((u, i) => (
                                  <a key={i} href={u} target="_blank" rel="noreferrer" className="ml-1 text-sky-600 hover:underline">
                                    {u.slice(0, 40)}...
                                  </a>
                                ))}
                                {r.citedUrls.length > 3 && <span className="ml-1 text-muted-foreground">+{r.citedUrls.length - 3}</span>}
                              </div>
                            )}
                            {r.mentionedBrands.length > 0 && (
                              <div>
                                <span className="font-mono text-muted-foreground">提及品牌: </span>
                                {r.mentionedBrands.join(", ")}
                              </div>
                            )}
                            {r.mentionedCompetitors.length > 0 && (
                              <div>
                                <span className="font-mono text-muted-foreground">提及竞品: </span>
                                {r.mentionedCompetitors.join(", ")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DashboardSection>
    </div>
  );
}
