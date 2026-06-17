"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Finding {
  code: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
  currentValue?: string | number | null;
  expectedValue?: string | number | null;
}

interface Recommendation {
  code: string;
  title: string;
  priority: 1 | 2 | 3;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  category: "content" | "technical" | "performance" | "links" | "metadata";
  description: string;
  steps: string[];
  codeExample?: string;
  expectedBenefit: string;
}

interface AuditDetail {
  id: string;
  score: number;
  statusCode: number | null;
  indexable: boolean | null;
  findings: Finding[];
  rawSnapshot: {
    title?: string;
    description?: string;
    h1?: string;
    wordCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    imageCount: number;
    imageWithAltCount: number;
    hasCanonical: boolean;
    hasSchema: boolean;
    hasOpenGraph: boolean;
    performance?: {
      ttfb: number;
      fcp: number | null;
      lcp: number | null;
      tbt: number;
    };
    crawlMethod?: string;
    crawlErrors?: Array<{ phase: string; kind: string; message: string }>;
    crawlElapsedMs?: number;
  };
  createdAt: string;
  page: {
    id: string;
    url: string;
    title: string | null;
    projectId: string;
  };
}

const SEVERITY_STYLES = {
  high: "border-destructive/50 bg-destructive/5",
  medium: "border-warning/50 bg-warning/5",
  low: "border-info/50 bg-info/5",
};

const SEVERITY_BADGE = {
  high: "badge-error",
  medium: "badge-warning",
  low: "badge-info",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskResult, setTaskResult] = useState<{ recommendations: number; tasks: number } | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [auditRes, recRes] = await Promise.all([
        fetch(`/api/audits/${params.id}`),
        fetch(`/api/audits/${params.id}/recommendations`),
      ]);
      const auditJson = await auditRes.json();
      if (!auditRes.ok) {
        setError(auditJson?.error?.message ?? "加载失败");
      } else {
        setAudit(auditJson.data);
      }
      if (recRes.ok) {
        const recJson = await recRes.json();
        setRecommendations(recJson.data?.recommendations ?? []);
      }
      setLoading(false);
    })();
  }, [params.id]);

  async function createOptimizationTasks(minSeverity: "high" | "medium" | "low" = "medium") {
    setCreatingTasks(true);
    try {
      const res = await fetch(`/api/audits/${params.id}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createTasks: true, minSeverity }),
      });
      const json = await res.json();
      if (res.ok) {
        setTaskResult({ recommendations: json.data.recommendationsGenerated, tasks: json.data.tasksCreated });
      }
    } catch (err) {
      console.error("Failed to create tasks:", err);
    }
    setCreatingTasks(false);
  }

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>;
  }
  if (error) {
    return <div className="text-destructive">{error}</div>;
  }
  if (!audit) return null;

  const perf = audit.rawSnapshot.performance;
  const findings = audit.findings;
  const grouped = {
    high: findings.filter((f) => f.severity === "high"),
    medium: findings.filter((f) => f.severity === "medium"),
    low: findings.filter((f) => f.severity === "low"),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/audits" className="text-sm text-muted-foreground hover:underline">← 返回诊断列表</Link>
        <h1 className="mt-1 text-2xl font-semibold">{audit.page.title ?? audit.page.url}</h1>
        <p className="text-sm text-muted-foreground">
          <a href={audit.page.url} target="_blank" rel="noreferrer" className="hover:underline">{audit.page.url}</a>
        </p>
      </div>

      {/* 得分卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="eyebrow">seo_score</div>
          <div className={`metric-number mt-2 ${
            audit.score >= 80 ? "text-success" : audit.score >= 60 ? "text-warning" : "text-destructive"
          }`}>{audit.score}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">http_status</div>
          <div className="metric-number mt-2">{audit.statusCode ?? "—"}</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">indexable</div>
          <div className={`metric-number mt-2 ${audit.indexable ? "text-success" : "text-destructive"}`}>
            {audit.indexable ? "✓ 可索引" : "✗ 不可索引"}
          </div>
        </div>
      </div>

      {/* 生成任务按钮 */}
      {findings.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">一键创建优化任务</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                基于诊断结果自动生成可执行的优化任务，添加到任务看板
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void createOptimizationTasks("high")} disabled={creatingTasks} className="btn-ghost btn-sm">
                仅高优先级
              </button>
              <button onClick={() => void createOptimizationTasks("medium")} disabled={creatingTasks} className="btn-primary btn-sm">
                {creatingTasks ? "创建中..." : "创建中高低优先任务"}
              </button>
            </div>
          </div>
          {taskResult && (
            <div className="mt-3 flex items-center gap-2 rounded bg-success/10 px-3 py-2 text-sm text-success">
              ✓ 已生成 {taskResult.recommendations} 条建议，创建 {taskResult.tasks} 个优化任务
              <Link href="/tasks" className="underline">查看任务 →</Link>
            </div>
          )}
        </div>
      )}

      {/* 抓取错误（如有） */}
      {audit.rawSnapshot.crawlErrors && audit.rawSnapshot.crawlErrors.length > 0 && (
        <div className="card p-4 border-warning/50 bg-warning/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="eyebrow text-warning">crawl_errors · {audit.rawSnapshot.crawlErrors.length}</h3>
            {audit.rawSnapshot.crawlMethod && (
              <span className="badge badge-warning text-[10px]">method: {audit.rawSnapshot.crawlMethod}</span>
            )}
          </div>
          <div className="space-y-1">
            {audit.rawSnapshot.crawlErrors.map((e, i) => (
              <div key={i} className="text-xs font-mono flex items-start gap-2">
                <span className={`badge text-[10px] ${
                  e.kind === "tls" ? "badge-error" :
                  e.kind === "timeout" ? "badge-warning" : "badge-muted"
                }`}>{e.kind}</span>
                <span className="text-muted-foreground shrink-0">{e.phase}:</span>
                <span className="flex-1 truncate" title={e.message}>{e.message.slice(0, 120)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 性能指标 */}
      {perf && (
        <div className="card p-4">
          <h2 className="eyebrow">performance_metrics</h2>
          <div className="mt-4 grid grid-cols-4 gap-4">
            <Metric label="TTFB" value={perf.ttfb} unit="ms" good={800} />
            <Metric label="FCP" value={perf.fcp} unit="ms" good={1800} />
            <Metric label="LCP" value={perf.lcp} unit="ms" good={2500} />
            <Metric label="TBT" value={perf.tbt} unit="ms" good={200} />
          </div>
        </div>
      )}

      {/* 页面快照 */}
      <div className="card p-4">
        <h2 className="eyebrow">page_snapshot</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Pair label="Title" value={audit.rawSnapshot.title} />
          <Pair label="Meta Description" value={audit.rawSnapshot.description} />
          <Pair label="H1" value={audit.rawSnapshot.h1} />
          <Pair label="字数" value={String(audit.rawSnapshot.wordCount)} />
          <Pair label="内链 / 外链" value={`${audit.rawSnapshot.internalLinkCount} / ${audit.rawSnapshot.externalLinkCount}`} />
          <Pair label="图片 alt" value={`${audit.rawSnapshot.imageWithAltCount} / ${audit.rawSnapshot.imageCount}`} />
          <Pair label="Canonical" value={audit.rawSnapshot.hasCanonical ? "✓" : "✗"} />
          <Pair label="Schema" value={audit.rawSnapshot.hasSchema ? "✓" : "✗"} />
          <Pair label="Open Graph" value={audit.rawSnapshot.hasOpenGraph ? "✓" : "✗"} />
        </dl>
      </div>

      {/* 问题清单 */}
      <div>
        <h2 className="eyebrow">findings</h2>
        <div className="mt-2 text-lg font-semibold">问题清单（{findings.length} 项）</div>
        
        {findings.length === 0 ? (
          <div className="card p-8 text-center text-success">
            ✨ 未发现明显问题
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {(["high", "medium", "low"] as const).map((sev) =>
              grouped[sev].length === 0 ? null : (
                <div key={sev}>
                  <h3 className="eyebrow mb-2">
                    {SEVERITY_LABEL[sev]}优先级（{grouped[sev].length} 项）
                  </h3>
                  <div className="space-y-2">
                    {grouped[sev].map((f) => (
                      <div key={f.code} className={`card p-4 ${SEVERITY_STYLES[sev]}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium">{f.title}</h4>
                          <span className={`badge ${SEVERITY_BADGE[sev]} text-[10px]`}>{f.code}</span>
                        </div>
                        <p className="mt-2 text-sm">{f.description}</p>
                        <div className="mt-2 rounded bg-background/50 p-2 text-sm">
                          <div className="text-[10px] uppercase text-muted-foreground">recommendation</div>
                          <div className="mt-1">{f.recommendation}</div>
                        </div>
                        {(f.currentValue !== undefined || f.expectedValue !== undefined) && (
                          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                            <span>当前: {String(f.currentValue ?? "—")}</span>
                            <span>期望: {String(f.expectedValue ?? "—")}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* 详细优化建议（步骤 + 代码示例） */}
        {recommendations.length > 0 && (
          <div className="mt-8">
            <h2 className="eyebrow">optimization_playbook</h2>
            <div className="mt-2 text-lg font-semibold">
              可执行优化建议（{recommendations.length} 项）
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              基于诊断结果生成，每条建议包含具体步骤、代码示例和预期收益
            </p>

            <div className="mt-4 space-y-3">
              {recommendations
                .sort((a, b) => a.priority - b.priority)
                .map((rec) => {
                  const expanded = expandedFinding === rec.code;
                  const impactColors = {
                    high: "border-destructive/50 bg-destructive/5",
                    medium: "border-warning/50 bg-warning/5",
                    low: "border-info/50 bg-info/5",
                  };
                  const categoryIcons: Record<string, string> = {
                    content: "📝", technical: "⚙️", performance: "⚡", links: "🔗", metadata: "📋",
                  };
                  return (
                    <div key={rec.code} className={`card overflow-hidden ${impactColors[rec.impact]}`}>
                      <button
                        onClick={() => setExpandedFinding(expanded ? null : rec.code)}
                        className="w-full p-4 text-left hover:bg-background/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xl">{categoryIcons[rec.category] ?? "•"}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{rec.title}</span>
                                <span className="badge text-[10px] bg-background/50">P{rec.priority}</span>
                                <span className={`badge text-[10px] ${
                                  rec.impact === "high" ? "badge-error" :
                                  rec.impact === "medium" ? "badge-warning" : "badge-info"
                                }`}>
                                  impact: {rec.impact}
                                </span>
                                <span className="badge text-[10px] bg-muted text-muted-foreground">
                                  effort: {rec.effort}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                            </div>
                          </div>
                          <span className="text-muted-foreground text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-border/50 bg-background/30 p-4 space-y-3 animate-in slide-in-from-top-2">
                          {/* Steps */}
                          <div>
                            <div className="eyebrow mb-2">steps</div>
                            <ol className="space-y-1 text-sm list-decimal list-inside">
                              {rec.steps.map((s, i) => (
                                <li key={i} className="text-foreground/80">{s}</li>
                              ))}
                            </ol>
                          </div>

                          {/* Code Example */}
                          {rec.codeExample && (
                            <div>
                              <div className="eyebrow mb-2">code_example</div>
                              <pre className="bg-background border border-border rounded p-3 text-xs font-mono overflow-x-auto">
                                <code>{rec.codeExample}</code>
                              </pre>
                            </div>
                          )}

                          {/* Expected Benefit */}
                          <div className="rounded bg-success/10 border border-success/30 p-3">
                            <div className="eyebrow text-success mb-1">expected_benefit</div>
                            <p className="text-sm">{rec.expectedBenefit}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, unit, good }: { label: string; value: number | null; unit: string; good: number }) {
  const isGood = value !== null && value <= good;
  return (
    <div className="text-center">
      <div className="eyebrow">{label}</div>
      <div className={`metric-number-sm mt-1 ${isGood ? "text-success" : "text-destructive"}`}>
        {value !== null ? `${Math.round(value)}${unit}` : "—"}
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">{value || "—"}</dd>
    </div>
  );
}
