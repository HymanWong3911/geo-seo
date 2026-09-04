"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { DonutChart, BarChart, Sparkline, ScoreRing, EmptyState } from "@/components/ui/DashboardWidgets";
import { Skeleton } from "@/components/ui/Skeleton";

interface Finding {
  code: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
}

interface PageAudit {
  id: string;
  score: number;
  statusCode: number | null;
  indexable: boolean | null;
  findings: Finding[];
  createdAt: string;
  page: {
    id: string;
    url: string;
    title: string | null;
    projectId?: string;
  };
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<PageAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [url, setUrl] = useState("");
  const { t } = useI18n();
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [scoreFilter, setScoreFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const url = new URL("/api/audit-feed", window.location.origin);
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      setAudits(json.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/audits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, sync: true }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setResult(json?.error?.message ?? "审计失败");
      return;
    }
    setResult(`审计完成！分数 ${json.data.score}，问题数 ${json.data.findingsCount}`);
    setUrl("");
    void load();
  }

  const filtered = useMemo(() => audits.filter(a => {
    if (scoreFilter === "excellent" && a.score < 80) return false;
    if (scoreFilter === "good" && (a.score < 60 || a.score >= 80)) return false;
    if (scoreFilter === "poor" && a.score >= 60) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((a.page.title ?? "").toLowerCase().includes(q) || a.page.url.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [audits, scoreFilter, search]);

  // KPI
  const stats = useMemo(() => {
    const total = audits.length;
    const avgScore = total > 0 ? Math.round(audits.reduce((s, a) => s + a.score, 0) / total) : 0;
    const excellent = audits.filter(a => a.score >= 80).length;
    const good = audits.filter(a => a.score >= 60 && a.score < 80).length;
    const poor = audits.filter(a => a.score < 60).length;
    const totalHigh = audits.reduce((s, a) => s + a.findings.filter(f => f.severity === "high").length, 0);
    const indexable = audits.filter(a => a.indexable).length;
    const passRate = total > 0 ? Math.round((excellent / total) * 100) : 0;
    return { total, avgScore, excellent, good, poor, totalHigh, indexable, passRate };
  }, [audits]);

  // 分数区间分布
  const scoreDistribution = useMemo(() => [
    { label: "优秀 80-100", value: stats.excellent, color: "hsl(142 71% 45%)" },
    { label: "良好 60-79", value: stats.good, color: "hsl(38 92% 50%)" },
    { label: "较差 < 60", value: stats.poor, color: "hsl(0 84% 60%)" },
  ].filter(s => s.value > 0), [stats]);

  // 7天 audit trend
  const auditTrend = useMemo(() => {
    const days = 7;
    const buckets: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const cnt = audits.filter(a => {
        const t = new Date(a.createdAt).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).length;
      buckets.push(cnt);
    }
    return buckets;
  }, [audits]);

  // Top 低分页面
  const lowScorePages = useMemo(() => {
    return [...audits]
      .filter(a => a.score < 80)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6)
      .map(a => ({ label: a.page.title ?? a.page.url.slice(0, 30), value: a.score, color: a.score < 60 ? "hsl(0 84% 60%)" : "hsl(38 92% 50%)" }));
  }, [audits]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// SEO — 页面诊断</div>
          <h1 className="mt-2">SEO 诊断</h1>
          <p className="text-sm text-muted-foreground mt-1">输入 URL，系统自动抓取页面 + 评分 + 问题清单</p>
        </div>
        <div className="page-header-right">
          <button onClick={() => setShowNew(true)} className="btn-primary">+ 新建诊断</button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : audits.length === 0 ? (
        <div className="empty-state">
          <span className="status-dot idle" /> 暂无诊断记录，点击右上角新建</div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card p-4">
              <div className="eyebrow">total</div>
              <div className="metric-number mt-1">{stats.total}</div>
              <div className="mt-1"><Sparkline data={auditTrend} color="hsl(var(--primary))" /></div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">avg_score</div>
              <div className={`metric-number mt-1 ${stats.avgScore >= 80 ? "text-success" : stats.avgScore >= 60 ? "text-warning" : "text-destructive"}`}>{stats.avgScore}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">/ 100</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">pass_rate</div>
              <div className={`metric-number mt-1 ${stats.passRate >= 80 ? "text-success" : stats.passRate >= 50 ? "text-warning" : "text-destructive"}`}>{stats.passRate}%</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">{stats.excellent} ≥ 80 分</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">high_findings</div>
              <div className={`metric-number mt-1 ${stats.totalHigh > 0 ? "text-destructive" : "text-success"}`}>{stats.totalHigh}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">高严重度问题</div>
            </div>
            <div className="card p-4">
              <div className="eyebrow">indexable</div>
              <div className="metric-number mt-1 text-primary">{stats.indexable}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">/ {stats.total}</div>
            </div>
          </div>

          {/* 可视化 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="card p-4">
              <h3 className="eyebrow mb-3">score_distribution</h3>
              <DonutChart
                segments={scoreDistribution}
                centerLabel="avg"
                centerValue={stats.avgScore}
                size={120}
                thickness={14}
              />
            </div>
            <div className="card p-4 lg:col-span-2">
              <h3 className="eyebrow mb-3">low_score_pages · 重点关注</h3>
              {lowScorePages.length > 0 ? (
                <BarChart data={lowScorePages} max={100} defaultColor="hsl(38 92% 50%)" />
              ) : (
                <EmptyState icon="✨" description="所有页面 ≥ 80 分,棒!" />
              )}
            </div>
          </div>

          {/* 筛选 */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setScoreFilter("")}
                className={`badge cursor-pointer ${!scoreFilter ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-border"}`}
              >全部</button>
              <button
                onClick={() => setScoreFilter("excellent")}
                className={`badge cursor-pointer ${scoreFilter === "excellent" ? "bg-success/20 text-success border border-success/40" : "bg-muted text-muted-foreground border border-border"}`}
              >优秀 ≥ 80</button>
              <button
                onClick={() => setScoreFilter("good")}
                className={`badge cursor-pointer ${scoreFilter === "good" ? "bg-warning/20 text-warning border border-warning/40" : "bg-muted text-muted-foreground border border-border"}`}
              >良好 60-79</button>
              <button
                onClick={() => setScoreFilter("poor")}
                className={`badge cursor-pointer ${scoreFilter === "poor" ? "bg-destructive/20 text-destructive border border-destructive/40" : "bg-muted text-muted-foreground border border-border"}`}
              >较差 &lt; 60</button>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索 URL 或标题..."
              className="input-field flex-1 min-w-[200px]"
            />
          </div>

          {/* 表格 */}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left p-3">page</th>
                  <th className="text-center p-3">score</th>
                  <th className="text-center p-3">findings</th>
                  <th className="text-center p-3">status</th>
                  <th className="text-left p-3">timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <Link href={`/audits/${a.id}`} className="text-foreground hover:text-primary text-sm font-medium">
                        {a.page.title ?? a.page.url}
                      </Link>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-md">{a.page.url}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <ScoreRing score={a.score} size={36} strokeWidth={3} showLabel={false} />
                        <span className={`text-sm font-mono font-semibold ${a.score >= 80 ? "text-success" : a.score >= 60 ? "text-warning" : "text-destructive"}`}>{a.score}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs font-mono">
                        {a.findings.filter(f => f.severity === "high").length > 0 && <span className="badge bg-destructive/15 text-destructive text-[10px]">{a.findings.filter(f => f.severity === "high").length}H</span>}
                        {a.findings.filter(f => f.severity === "medium").length > 0 && <span className="badge bg-warning/15 text-warning text-[10px]">{a.findings.filter(f => f.severity === "medium").length}M</span>}
                        {a.findings.filter(f => f.severity === "low").length > 0 && <span className="badge bg-info/15 text-info text-[10px]">{a.findings.filter(f => f.severity === "low").length}L</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono text-xs">
                      <span className="text-foreground">{a.statusCode ?? "—"}</span>
                      <span className={`ml-2 badge text-[10px] ${a.indexable ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {a.indexable ? "index" : "noindex"}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("zh-CN", { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showNew && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && (setShowNew(false), setResult(null))}>
          <form onSubmit={handleSubmit} className="dialog-panel p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="eyebrow">// SEO — 新建诊断</div>
                <h2 className="mt-2 text-lg">新建页面诊断</h2>
              </div>
              <button type="button" onClick={() => { setShowNew(false); setResult(null); }} className="btn-icon">×</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">项目 ID <span className="text-destructive">*</span></label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input
                  type="text"
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="clxxx..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">页面 URL <span className="text-destructive">*</span></label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  placeholder="https://example.com/page" />
              </div>
              <div className="mt-1 text-[10px] font-mono text-muted-foreground">将同步抓取 + 分析，通常 5-15 秒</div>
            </div>
            {result && (
              <div className={`border px-3 py-2 font-mono text-xs ${
                result.includes("完成")
                  ? "border-success/50 bg-success/5 text-success"
                  : "border-destructive/50 bg-destructive/5 text-destructive"
              }`}>
                [ status ] {result}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => { setShowNew(false); setResult(null); }} className="btn-ghost">取消</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "扫描中..." : "开始诊断 →"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
