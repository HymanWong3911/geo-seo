"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { MiniChart } from "@/components/ui/DashboardWidgets";

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
  positive: "badge-success",
  neutral: "badge-muted",
  negative: "badge-error",
  mixed: "badge-warning",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
  mixed: "混合",
};

const SOURCE_BADGE: Record<string, { color: string; icon: string; label: string }> = {
  bing: { color: "badge-info", icon: "🔵", label: "Bing" },
  "360": { color: "badge-success", icon: "🟢", label: "360" },
  searxng: { color: "badge-primary", icon: "🔍", label: "SearXNG" },
  google: { color: "badge-warning", icon: "🟡", label: "Google" },
  duckduckgo: { color: "badge-gold", icon: "🦆", label: "DuckDuckGo" },
};

export default function BrandMonitorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [mentions, setMentions] = useState<BrandMention[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number; mentions?: BrandMentionResult[] } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [scanPhase, setScanPhase] = useState<"idle" | "searching" | "analyzing" | "persisting">("idle");
  const { t } = useI18n();

  interface BrandMentionResult {
    source: string; url: string; title: string; content: string;
    brandName: string; mentionType: string; sentiment: string;
    publishedAt: string; relevanceScore: number;
  }

  async function load() {
    if (!projectId) { setMentions([]); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/brand-mentions?limit=200`);
      const json = await res.json();
      if (res.ok) setMentions(json.data ?? []);
      else setError(json?.error?.message ?? "加载失败");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]);

  async function triggerScan() {
    if (!projectId) return;
    setError("");
    setScanning(true);
    setScanResult(null);
    setScanPhase("searching");
    try {
      // 显示进度阶段
      const phaseTimer1 = setTimeout(() => setScanPhase("analyzing"), 1500);
      const phaseTimer2 = setTimeout(() => setScanPhase("persisting"), 3500);
      const res = await fetch(`/api/projects/${projectId}/brand-monitor/refresh`, { method: "POST" });
      clearTimeout(phaseTimer1); clearTimeout(phaseTimer2);
      const json = await res.json();
      if (!res.ok) setError(json?.error?.message ?? "扫描失败");
      else { setScanResult({ count: json.data?.count ?? 0, mentions: json.data?.mentions }); await load(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setScanning(false);
      setScanPhase("idle");
    }
  }

  // 筛选
  const filteredMentions = useMemo(() => mentions.filter(m => {
    if (filter === "primary_brand" && m.mentionType !== "primary_brand") return false;
    if (filter === "competitor" && m.mentionType !== "competitor") return false;
    if (filter === "positive" && m.sentiment !== "positive") return false;
    if (filter === "negative" && m.sentiment !== "negative") return false;
    if (sourceFilter && m.source !== sourceFilter) return false;
    return true;
  }), [mentions, filter, sourceFilter]);

  // 统计
  const stats = useMemo(() => ({
    total: mentions.length,
    primaryBrand: mentions.filter(m => m.mentionType === "primary_brand").length,
    competitor: mentions.filter(m => m.mentionType === "competitor").length,
    positive: mentions.filter(m => m.sentiment === "positive").length,
    negative: mentions.filter(m => m.sentiment === "negative").length,
    neutral: mentions.filter(m => m.sentiment === "neutral").length,
    avgRelevance: mentions.length > 0 ? Math.round(mentions.reduce((s, m) => s + (m.relevanceScore ?? 0), 0) / mentions.length) : 0,
  }), [mentions]);

  // 来源分布
  const sourceBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of mentions) m.set(x.source, (m.get(x.source) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [mentions]);

  // 7天发现趋势
  const trendData = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const m of mentions) {
      const k = m.discoveredAt.slice(0, 10);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return Array.from(buckets.values());
  }, [mentions]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M11 — Brand Monitor</div>
          <h1 className="mt-2">品牌监控</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => void triggerScan()} disabled={scanning} className="btn-primary">
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-current rounded-full animate-pulse" />
                  扫描中...
                </span>
              ) : "立即扫描"}
            </button>
          )}
        </div>
      </header>
      <p className="text-sm text-muted-foreground">{t.pageDesc.brandMonitor}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : (
        <>
          {/* 统计面板 */}
          {!loading && mentions.length > 0 && (
            <div className="grid grid-cols-6 gap-px bg-border">
              <div className="cell"><div className="eyebrow">total</div><div className="metric-number-sm mt-1">{stats.total}</div></div>
              <div className="cell"><div className="eyebrow">primary</div><div className="metric-number-sm mt-1 text-info">{stats.primaryBrand}</div></div>
              <div className="cell"><div className="eyebrow">competitor</div><div className="metric-number-sm mt-1 text-warning">{stats.competitor}</div></div>
              <div className="cell"><div className="eyebrow">positive</div><div className="metric-number-sm mt-1 text-success">{stats.positive}</div></div>
              <div className="cell"><div className="eyebrow">negative</div><div className="metric-number-sm mt-1 text-destructive">{stats.negative}</div></div>
              <div className="cell"><div className="eyebrow">avg_relevance</div><div className="metric-number-sm mt-1">{stats.avgRelevance}</div></div>
            </div>
          )}

          {/* 来源分布 + 7天趋势 */}
          {!loading && mentions.length > 0 && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-4">
                <div className="eyebrow mb-3">source_breakdown</div>
                <div className="space-y-2">
                  {sourceBreakdown.map(([src, count]) => {
                    const cfg = SOURCE_BADGE[src] ?? { color: "badge-muted", icon: "•", label: src };
                    const pct = Math.round((count / stats.total) * 100);
                    return (
                      <div key={src} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2">
                            <span>{cfg.icon}</span>
                            <button
                              onClick={() => setSourceFilter(sourceFilter === src ? "" : src)}
                              className={`badge ${cfg.color} text-[10px] cursor-pointer ${sourceFilter === src ? "ring-1 ring-primary" : ""}`}
                            >{cfg.label}</button>
                          </span>
                          <span className="font-mono tabular-nums text-muted-foreground">{count} · {pct}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="eyebrow">discovered_trend · 7d</div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">total {stats.total}</span>
                </div>
                <MiniChart data={trendData.length > 0 ? trendData : [0]} color="info" height={64} />
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>7天前</span>
                  <span>今天</span>
                </div>
              </div>
            </div>
          )}

          {/* 说明 + 数据源 */}
          <div className="card p-4 text-xs text-muted-foreground space-y-2">
            <div>
              <strong className="text-foreground">数据源：</strong>
              <span className="badge badge-info text-[10px] ml-1">Bing</span>
              <span className="badge badge-success text-[10px] ml-1">360 搜索</span>
              <span className="badge badge-primary text-[10px] ml-1">SearXNG</span>
              <span className="badge badge-gold text-[10px] ml-1">DuckDuckGo</span>
            </div>
            <div>
              每次扫描：搜索主品牌 + 别名 + 竞品，从多源取前 {scanResult?.mentions?.length ?? 5} 条结果，去重后写入 BrandMention 表。
              来源优先级：SearXNG → Bing → 360 独立抓取。
            </div>
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
            <div className="card p-3 border-success/50 bg-success/5 text-sm text-success flex items-center justify-between">
              <span>✓ 扫描完成，新增 {scanResult.count} 条品牌提及</span>
              <span className="text-[10px] font-mono text-muted-foreground">最近一次: {new Date().toLocaleString()}</span>
            </div>
          )}

          {error && (
            <div className="card p-3 border-destructive/50 bg-destructive/5 text-sm text-destructive">
              [ error ] {error}
            </div>
          )}

          {/* 筛选 */}
          {!loading && mentions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilter("")} className={`badge ${!filter ? "badge-primary" : "badge-muted"} cursor-pointer`}>全部</button>
              <button onClick={() => setFilter("primary_brand")} className={`badge ${filter === "primary_brand" ? "badge-info" : "badge-muted"} cursor-pointer`}>主品牌</button>
              <button onClick={() => setFilter("competitor")} className={`badge ${filter === "competitor" ? "badge-warning" : "badge-muted"} cursor-pointer`}>竞品</button>
              <button onClick={() => setFilter("positive")} className={`badge ${filter === "positive" ? "badge-success" : "badge-muted"} cursor-pointer`}>正面</button>
              <button onClick={() => setFilter("negative")} className={`badge ${filter === "negative" ? "badge-error" : "badge-muted"} cursor-pointer`}>负面</button>
              {sourceFilter && (
                <button onClick={() => setSourceFilter("")} className="badge badge-primary cursor-pointer">
                  来源: {sourceFilter} ✕
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
            <div className="empty-state">
              [ no_mentions ] — {mentions.length === 0 ? "点击「立即扫描」开始监控" : "没有匹配的提及"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMentions.map((m) => {
                const srcCfg = SOURCE_BADGE[m.source] ?? { color: "badge-muted", icon: "•", label: m.source };
                return (
                  <div key={m.id} className="card p-4 card-hover">
                    <div className="flex items-start justify-between gap-3">
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:text-primary transition-colors flex-1">
                        {m.title}
                      </a>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <div className="flex gap-1">
                          <span className={`badge ${srcCfg.color} text-[10px]`}>{srcCfg.icon} {srcCfg.label}</span>
                          {m.sentiment && (
                            <span className={`badge ${SENTIMENT_BADGE[m.sentiment]} text-[10px]`}>
                              {SENTIMENT_LABEL[m.sentiment] || m.sentiment}
                            </span>
                          )}
                        </div>
                        <span className={`badge text-[10px] ${m.mentionType === "primary_brand" ? "badge-info" : "badge-gold"}`}>
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
