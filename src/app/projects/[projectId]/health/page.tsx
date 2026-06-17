"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Dimension {
  score: number;
  weight: number;
  [k: string]: unknown;
}

interface HealthData {
  totalScore: number;
  level: "excellent" | "good" | "warning" | "critical";
  dimensions: {
    seo: Dimension;
    geo: Dimension;
    tasks: Dimension;
    freshness: Dimension;
    resources: Dimension;
  };
  issues: Array<{ severity: "high" | "medium" | "low"; title: string; detail: string }>;
  lastUpdated: string;
}

const LEVEL_COLOR: Record<string, string> = {
  excellent: "text-success",
  good: "text-info",
  warning: "text-warning",
  critical: "text-destructive",
};
const LEVEL_LABEL: Record<string, string> = {
  excellent: "优秀",
  good: "良好",
  warning: "警告",
  critical: "危急",
};
const LEVEL_GRADIENT: Record<string, string> = {
  excellent: "from-success to-info",
  good: "from-info to-primary",
  warning: "from-warning to-primary",
  critical: "from-destructive to-warning",
};

const SEV_COLOR: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-info/30 bg-info/10 text-info",
};

export default function ProjectHealthPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/health`);
      const json = await res.json();
      setData(json.data);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="card py-12 text-center">
        <span className="status-dot idle" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING HEALTH SCORE...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card py-12 text-center text-sm text-destructive">
        健康度数据加载失败
      </div>
    );
  }

  const dims = data.dimensions;
  const issuesByLevel = {
    high: data.issues.filter((i) => i.severity === "high").length,
    medium: data.issues.filter((i) => i.severity === "medium").length,
    low: data.issues.filter((i) => i.severity === "low").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // M01 · PROJECT HEALTH SCORE
        </div>
        <h1 className="text-3xl font-semibold">
          <span className="text-gradient">健康度仪表</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">
            ← 返回总览
          </Link>
        </p>
      </div>

      {/* 总分卡 */}
      <div className="card relative overflow-hidden">
        <div className={`absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gradient-to-br ${LEVEL_GRADIENT[data.level]} opacity-20 blur-3xl`} />
        <div className="relative grid gap-6 sm:grid-cols-3">
          <div className="text-center sm:col-span-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              OVERALL
            </div>
            <div className="mt-2 metric-number">{data.totalScore}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">/ 100</div>
            <div className={`mt-3 inline-block rounded-md border px-3 py-1 font-mono text-xs ${LEVEL_COLOR[data.level]} border-current`}>
              {LEVEL_LABEL[data.level]}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              5 维度贡献
            </div>
            <div className="space-y-2">
              {Object.entries(dims).map(([key, dim]) => {
                const dimData = dim as Dimension & { [k: string]: unknown };
                const score = dimData.score;
                const weight = dimData.weight;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-20 font-mono text-xs text-muted-foreground">
                      {key.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full bg-gradient-to-r ${LEVEL_GRADIENT[data.level]} transition-all`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-right font-mono text-xs">
                      {score}
                    </div>
                    <div className="w-16 text-right font-mono text-[10px] text-muted-foreground">
                      ×{Math.round(weight * 100)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 风险信号 */}
      {data.issues.length > 0 && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                // ISSUES
              </div>
              <h2 className="mt-1 text-lg font-semibold">风险信号（{data.issues.length}）</h2>
            </div>
            <div className="flex gap-2 font-mono text-[10px]">
              {issuesByLevel.high > 0 && (
                <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
                  {issuesByLevel.high} HIGH
                </span>
              )}
              {issuesByLevel.medium > 0 && (
                <span className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-warning">
                  {issuesByLevel.medium} MED
                </span>
              )}
              {issuesByLevel.low > 0 && (
                <span className="rounded border border-info/30 bg-info/10 px-2 py-0.5 text-info">
                  {issuesByLevel.low} LOW
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {data.issues.map((iss, i) => (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 ${SEV_COLOR[iss.severity]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                    {iss.severity}
                  </span>
                  <span className="font-semibold">{iss.title}</span>
                </div>
                <div className="mt-1 text-xs opacity-80">{iss.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 详细维度 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DimensionCard name="SEO" data={dims.seo} extra={[
          ["最近审计数", dims.seo.audits ?? "—"],
        ]} />
        <DimensionCard name="GEO" data={dims.geo} extra={[
          ["7 天 runs", dims.geo.runs7d ?? 0],
          ["主品牌提及", dims.geo.brandMentioned ?? 0],
          ["总问题", dims.geo.totalQuestions ?? 0],
        ]} />
        <DimensionCard name="任务" data={dims.tasks} extra={[
          ["已完成", dims.tasks.done ?? 0],
          ["总数", dims.tasks.total ?? 0],
        ]} />
        <DimensionCard name="监测新鲜度" data={dims.freshness} extra={[
          ["最近 run", dims.freshness.lastRunAt ? new Date(dims.freshness.lastRunAt as string).toLocaleString("zh-CN", { hour12: false }) : "从未跑过"],
        ]} />
        <DimensionCard
          name="资源完整度"
          data={dims.resources}
          extra={[
            ["关键词", dims.resources.keywords ?? 0],
            ["GEO 问题", dims.resources.geoQuestions ?? 0],
            ["品牌提及", dims.resources.brandMentions ?? 0],
          ]}
        />
      </div>

      <div className="text-center font-mono text-[10px] text-muted-foreground">
        LAST_UPDATED :: {new Date(data.lastUpdated).toLocaleString("zh-CN", { hour12: false })}
      </div>
    </div>
  );
}

function DimensionCard({
  name,
  data,
  extra,
}: {
  name: string;
  data: Dimension;
  extra: Array<[string, unknown]>;
}) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {name}
        </span>
        <span className="metric-number text-2xl">{data.score}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent"
          style={{ width: `${data.score}%` }}
        />
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {extra.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span>
            <span className="font-mono text-foreground">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}