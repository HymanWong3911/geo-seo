"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Skeleton } from "@/components/ui/Skeleton";

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

export default function BrandMonitorPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [mentions, setMentions] = useState<BrandMention[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const { t } = useI18n();

  async function load() {
    if (!projectId) {
      setMentions([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/brand-mentions?limit=50`);
      const json = await res.json();
      if (res.ok) {
        setMentions(json.data ?? []);
      } else {
        setError(json?.error?.message ?? "加载失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function triggerScan() {
    if (!projectId) return;
    setError("");
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/brand-monitor/refresh`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "扫描失败");
      } else {
        setScanResult({ count: json.data?.count ?? 0 });
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setScanning(false);
    }
  }

  const filteredMentions = mentions.filter(m => {
    if (!filter) return true;
    if (filter === "primary_brand" && m.mentionType !== "primary_brand") return false;
    if (filter === "competitor" && m.mentionType !== "competitor") return false;
    if (filter === "positive" && m.sentiment !== "positive") return false;
    if (filter === "negative" && m.sentiment !== "negative") return false;
    return true;
  });

  const stats = {
    total: mentions.length,
    primaryBrand: mentions.filter(m => m.mentionType === "primary_brand").length,
    competitor: mentions.filter(m => m.mentionType === "competitor").length,
    positive: mentions.filter(m => m.sentiment === "positive").length,
    negative: mentions.filter(m => m.sentiment === "negative").length,
  };

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
              {scanning ? "扫描中..." : "立即扫描"}
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
          {/* 统计卡片 */}
          {!loading && mentions.length > 0 && (
            <div className="grid grid-cols-5 gap-px bg-border">
              <div className="cell"><div className="eyebrow">total</div><div className="metric-number-sm mt-1">{stats.total}</div></div>
              <div className="cell"><div className="eyebrow">primary</div><div className="metric-number-sm mt-1">{stats.primaryBrand}</div></div>
              <div className="cell"><div className="eyebrow">competitor</div><div className="metric-number-sm mt-1">{stats.competitor}</div></div>
              <div className="cell"><div className="eyebrow">positive</div><div className="metric-number-sm mt-1 text-success">{stats.positive}</div></div>
              <div className="cell"><div className="eyebrow">negative</div><div className="metric-number-sm mt-1 text-destructive">{stats.negative}</div></div>
            </div>
          )}

          {/* 提示信息 */}
          <div className="card p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">说明：</strong>使用 Bing + DuckDuckGo 公开搜索。
            每次扫描：搜索主品牌 + 别名 + 竞品，取前 5 条结果，写入 BrandMention 表。
            <br />
            <span className="mt-1 inline-block">v1.3 计划接入：新闻 / 知乎 / 微博 / 公众号 / Reddit</span>
          </div>

          {/* 扫描结果反馈 */}
          {scanResult && (
            <div className="card p-3 border-success/50 bg-success/5 text-sm text-success">
              ✓ 扫描完成，新增 {scanResult.count} 条品牌提及
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
              <button
                onClick={() => setFilter("")}
                className={`badge ${!filter ? "badge-primary" : "badge-muted"} cursor-pointer`}
              >
                全部
              </button>
              <button
                onClick={() => setFilter("primary_brand")}
                className={`badge ${filter === "primary_brand" ? "badge-primary" : "badge-muted"} cursor-pointer`}
              >
                主品牌
              </button>
              <button
                onClick={() => setFilter("competitor")}
                className={`badge ${filter === "competitor" ? "badge-primary" : "badge-muted"} cursor-pointer`}
              >
                竞品
              </button>
              <button
                onClick={() => setFilter("positive")}
                className={`badge ${filter === "positive" ? "badge-success" : "badge-muted"} cursor-pointer`}
              >
                正面
              </button>
              <button
                onClick={() => setFilter("negative")}
                className={`badge ${filter === "negative" ? "badge-error" : "badge-muted"} cursor-pointer`}
              >
                负面
              </button>
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
              {filteredMentions.map((m) => (
                <div key={m.id} className="card p-4 card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground hover:text-primary transition-colors flex-1"
                    >
                      {m.title}
                    </a>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <div className="flex gap-1">
                        {m.sentiment && (
                          <span className={`badge ${SENTIMENT_BADGE[m.sentiment]} text-[10px]`}>
                            {SENTIMENT_LABEL[m.sentiment] || m.sentiment}
                          </span>
                        )}
                        <span className={`badge text-[10px] ${
                          m.mentionType === "primary_brand" ? "badge-info" : "badge-gold"
                        }`}>
                          {m.brandName}
                        </span>
                      </div>
                    </div>
                  </div>
                  {m.content && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{m.content}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                    <span>source: {m.source}</span>
                    <span>相关性: {m.relevanceScore ?? "—"}</span>
                    <span>{new Date(m.discoveredAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
