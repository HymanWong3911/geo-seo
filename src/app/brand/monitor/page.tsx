"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { MiniChart, DonutChart, BarChart, Sparkline, EmptyState } from "@/components/ui/DashboardWidgets";

interface BrandMention {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  content: string;
  brandName: string;
  mentionType: string;
  sentiment: string | null;
  relevanceScore: number | null;
  publishedAt: string;
  discoveredAt: string;
}

const SENTIMENT_BADGE: Record<string, string> = {
  positive: "bg-success/15 text-success border border-success/30",
  neutral: "bg-muted text-muted-foreground border border-border",
  negative: "bg-destructive/15 text-destructive border border-destructive/30",
  mixed: "bg-warning/15 text-warning border border-warning/30",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
  mixed: "混合",
};

const SOURCE_BADGE: Record<string, { bg: string; icon: string; label: string; donutColor: string }> = {
  bing: { bg: "bg-info/15 text-info border-info/30", icon: "🔵", label: "Bing", donutColor: "hsl(217 91% 60%)" },
  "360": { bg: "bg-success/15 text-success border-success/30", icon: "🟢", label: "360", donutColor: "hsl(142 71% 45%)" },
  duckduckgo: { bg: "bg-warning/15 text-warning border-warning/30", icon: "🦆", label: "DuckDuckGo", donutColor: "hsl(38 92% 50%)" },
  searxng: { bg: "bg-primary/15 text-primary border-primary/30", icon: "🔍", label: "SearXNG", donutColor: "hsl(33 38% 60%)" },
  google: { bg: "bg-warning/15 text-warning border-warning/30", icon: "🟡", label: "Google", donutColor: "hsl(48 96% 53%)" },
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "hsl(142 71% 45%)",
  neutral: "hsl(220 9% 46%)",
  negative: "hsl(0 84% 60%)",
  mixed: "hsl(38 92% 50%)",
};

export default function BrandMonitorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [mentions, setMentions] = useState<BrandMention[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number; sources?: string[]; elapsedMs?: number } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [scanPhase, setScanPhase] = useState<"idle" | "searching" | "analyzing" | "persisting">("idle");

  const load = useCallback(async () => {
    if (!projectId) { setMentions([]); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/brand-mentions?limit=300`);
      const json = await res.json();
      if (res.ok) setMentions(json.data ?? []);
      else setError(json?.error?.message ?? "加载失败");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function triggerScan() {
    if (!projectId) return;
    setError("");
    setScanning(true);
    setScanResult(null);
    setScanPhase("searching");
    const t0 = Date.now();
    try {
      const phaseTimer1 = setTimeout(() => setScanPhase("analyzing"), 1500);
      const phaseTimer2 = setTimeout(() => setScanPhase("persisting"), 4000);
      const res = await fetch(`/api/projects/${projectId}/brand-monitor/refresh`, { method: "POST" });
      clearTimeout(phaseTimer1); clearTimeout(phaseTimer2);
      const json = await res.json();
      if (!res.ok) setError(json?.error?.message ?? "扫描失败");
      else {
        const sources = Array.from(new Set((json.data?.mentions ?? []).map((m: { source: string }) => m.source))) as string[];
        setScanResult({ count: json.data?.count ?? 0, sources, elapsedMs: Date.now() - t0 });
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setScanning(false);
      setScanPhase("idle");
    }
  }

  const filteredMentions = useMemo(() => mentions.filter(m => {
    if (filter === "primary_brand" && m.mentionType !== "primary_brand") return false;
    if (filter === "competitor" && m.mentionType !== "competitor") return false;
    if (filter === "positive" && m.sentiment !== "positive") return false;
    if (filter === "negative" && m.sentiment !== "negative") return false;
    if (sourceFilter && m.source !== sourceFilter) return false;
    return true;
  }), [mentions, filter, sourceFilter]);

  const stats = useMemo(() => ({
    total: mentions.length,
    primaryBrand: mentions.filter(m => m.mentionType === "primary_brand").length,
    competitor: mentions.filter(m => m.mentionType === "competitor").length,
    positive: mentions.filter(m => m.sentiment === "positive").length,
    negative: mentions.filter(m => m.sentiment === "negative").length,
    neutral: mentions.filter(m => m.sentiment === "neutral").length,
    avgRelevance: mentions.length > 0 ? Math.round(mentions.reduce((s, m) => s + (m.relevanceScore ?? 0), 0) / mentions.length) : 0,
    last7d: mentions.filter(m => Date.now() - new Date(m.discoveredAt).getTime() < 7 * 86400000).length,
  }), [mentions]);

  // 来源分布(饼图)
  const sourceBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mentions) m.set(x.source, (m.get(x.source) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({
        label: SOURCE_BADGE[source]?.label ?? source,
        value: count,
        color: SOURCE_BADGE[source]?.donutColor ?? "hsl(220 9% 60%)",
      }));
  }, [mentions]);

  // 7天 sentiment 趋势
  const sentimentTrend = useMemo(() => {
    const days = 7;
    const buckets: Array<{ date: string; positive: number; neutral: number; negative: number; total: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const dayMentions = mentions.filter(m => {
        const t = new Date(m.discoveredAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      });
      buckets.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        positive: dayMentions.filter(m => m.sentiment === "positive").length,
        neutral: dayMentions.filter(m => m.sentiment === "neutral").length,
        negative: dayMentions.filter(m => m.sentiment === "negative").length,
        total: dayMentions.length,
      });
    }
    return buckets;
  }, [mentions]);

  // Top brands 柱图
  const topBrands = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mentions) m.set(x.brandName, (m.get(x.brandName) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [mentions]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// BRAND — Mention Monitor</div>
          <h1 className="mt-2">品牌监控</h1>
          <p className="text-sm text-muted-foreground mt-1">森田咨询 (www.sentian100.com)</p>
        </div>
        <div className="page-header-right"><ProjectSelector /></div>
      </header>

      {!projectId ? (
        <EmptyState icon="◎" title="选择项目" description="先在右上角选择一个项目，再开始扫描。" />
      ) : (
        <>
          {/* 扫描操作区 */}
          <div className="card p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="eyebrow mb-1">scan_action</div>
              <div className="text-sm">
                扫描全网,看哪些网站在讨论你的品牌和竞品
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                来源优先级:SearXNG → Bing → DuckDuckGo → 360,每次取前 5 条,写入 BrandMention
              </div>
            </div>
            <button
              onClick={() => void triggerScan()}
              disabled={scanning}
              className="btn-primary shrink-0"
            >
              {scanning ? "扫描中…" : "立即扫描"}
            </button>
          </div>

          {/* 扫描状态 */}
          {scanning && (
            <div className="card p-3 border-primary/30 bg-primary/5 text-sm">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                <span className="font-mono text-xs">
                  {scanPhase === "searching" && "→ searching_searxng..."}
                  {scanPhase === "analyzing" && "→ analyzing_results..."}
                  {scanPhase === "persisting" && "→ persisting_mentions..."}
                </span>
              </div>
            </div>
          )}

          {scanResult && !scanning && (
            <div className="card p-3 border-success/50 bg-success/5 text-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-success">
                <span>✓</span>
                <span>扫描完成,新增 <strong className="font-mono">{scanResult.count}</strong> 条品牌提及</span>
                {scanResult.sources && scanResult.sources.length > 0 && (
                  <div className="flex gap-1">
                    {scanResult.sources.map(s => (
                      <span key={s} className="badge badge-muted text-[10px]">{SOURCE_BADGE[s]?.icon} {SOURCE_BADGE[s]?.label ?? s}</span>
                    ))}
                  </div>
                )}
              </div>
              {scanResult.elapsedMs !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{(scanResult.elapsedMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}

          {error && (
            <div className="card p-3 border-destructive/50 bg-destructive/5 text-sm text-destructive">
              [ error ] {error}
            </div>
          )}

          {/* KPI 卡片 */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : mentions.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="card p-4">
                <div className="eyebrow">total</div>
                <div className="metric-number mt-1">{stats.total}</div>
              </div>
              <div className="card p-4">
                <div className="eyebrow">last_7d</div>
                <div className="metric-number mt-1 text-primary">{stats.last7d}</div>
                <div className="mt-1"><Sparkline data={sentimentTrend.map(s => s.total)} color="hsl(var(--primary))" /></div>
              </div>
              <div className="card p-4">
                <div className="eyebrow">positive</div>
                <div className="metric-number mt-1 text-success">{stats.positive}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0}%</div>
              </div>
              <div className="card p-4">
                <div className="eyebrow">negative</div>
                <div className="metric-number mt-1 text-destructive">{stats.negative}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0}%</div>
              </div>
              <div className="card p-4">
                <div className="eyebrow">avg_relevance</div>
                <div className="metric-number mt-1">{stats.avgRelevance}</div>
                <div className="text-[10px] text-muted-foreground mt-1">/ 100</div>
              </div>
            </div>
          )}

          {/* 可视化区 */}
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : mentions.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* 来源分布饼图 */}
              <div className="card p-4">
                <h3 className="eyebrow mb-3">source_breakdown</h3>
                {sourceBreakdown.length > 0 ? (
                  <DonutChart
                    segments={sourceBreakdown}
                    centerLabel="sources"
                    centerValue={sourceBreakdown.length}
                    size={120}
                    thickness={14}
                  />
                ) : (
                  <EmptyState icon="∅" description="暂无数据" />
                )}
              </div>

              {/* 7天 sentiment 趋势 */}
              <div className="card p-4">
                <h3 className="eyebrow mb-3">sentiment_trend · 7d</h3>
                {sentimentTrend.some(s => s.total > 0) ? (
                  <MiniChart
                    data={sentimentTrend.map(s => s.total)}
                    color="primary"
                    height={64}
                  />
                ) : (
                  <EmptyState icon="∅" description="过去 7 天无新增" />
                )}
                <div className="mt-2 flex gap-3 text-[10px] font-mono">
                  <span className="text-success">● positive {sentimentTrend.reduce((s, x) => s + x.positive, 0)}</span>
                  <span className="text-muted-foreground">● neutral {sentimentTrend.reduce((s, x) => s + x.neutral, 0)}</span>
                  <span className="text-destructive">● negative {sentimentTrend.reduce((s, x) => s + x.negative, 0)}</span>
                </div>
              </div>

              {/* Top 品牌柱图 */}
              <div className="card p-4">
                <h3 className="eyebrow mb-3">top_brands</h3>
                {topBrands.length > 0 ? (
                  <BarChart data={topBrands} />
                ) : (
                  <EmptyState icon="∅" description="暂无品牌" />
                )}
              </div>
            </div>
          )}

          {/* 筛选 */}
          {!loading && mentions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilter("")} className={`badge ${!filter ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}>全部</button>
              <button onClick={() => setFilter("primary_brand")} className={`badge ${filter === "primary_brand" ? "bg-info/20 text-info border-info/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}>主品牌</button>
              <button onClick={() => setFilter("competitor")} className={`badge ${filter === "competitor" ? "bg-warning/20 text-warning border-warning/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}>竞品</button>
              <button onClick={() => setFilter("positive")} className={`badge ${filter === "positive" ? "bg-success/20 text-success border-success/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}>正面</button>
              <button onClick={() => setFilter("negative")} className={`badge ${filter === "negative" ? "bg-destructive/20 text-destructive border-destructive/40" : "bg-muted text-muted-foreground border border-border"} cursor-pointer`}>负面</button>
              {sourceFilter && (
                <button onClick={() => setSourceFilter("")} className="badge bg-primary/20 text-primary border border-primary/40 cursor-pointer">
                  来源: {SOURCE_BADGE[sourceFilter]?.label ?? sourceFilter} ✕
                </button>
              )}
            </div>
          )}

          {/* 列表 */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : filteredMentions.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={mentions.length === 0 ? "还没有品牌提及" : "没有匹配的提及"}
              description={mentions.length === 0 ? "点击「立即扫描」开始监控全网" : "试试清除筛选条件"}
              action={mentions.length === 0 ? (
                <button onClick={() => void triggerScan()} disabled={scanning} className="btn-primary">
                  {scanning ? "扫描中…" : "立即扫描"}
                </button>
              ) : undefined}
            />
          ) : (
            <div className="space-y-3">
              {filteredMentions.map((m) => {
                const srcCfg = SOURCE_BADGE[m.source] ?? { bg: "bg-muted text-muted-foreground border-border", icon: "•", label: m.source };
                return (
                  <div key={m.id} className="card p-4 card-hover">
                    <div className="flex items-start justify-between gap-3">
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:text-primary transition-colors flex-1">
                        {m.title}
                      </a>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <div className="flex gap-1">
                          <span className={`badge text-[10px] ${srcCfg.bg}`}>{srcCfg.icon} {srcCfg.label}</span>
                          {m.sentiment && (
                            <span className={`badge text-[10px] ${SENTIMENT_BADGE[m.sentiment]}`}>
                              {SENTIMENT_LABEL[m.sentiment] || m.sentiment}
                            </span>
                          )}
                        </div>
                        <span className={`badge text-[10px] ${m.mentionType === "primary_brand" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                          {m.brandName}
                        </span>
                      </div>
                    </div>
                    {m.content && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{m.content}</p>}
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                      <span>相关性: {m.relevanceScore ?? "—"}</span>
                      <span>{new Date(m.discoveredAt).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
