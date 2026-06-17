"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ActivityData {
  days: number;
  series: Array<{
    date: string;
    geoRuns: number;
    geoSuccess: number;
    audits: number;
    avgScore: number | null;
    tasksCreated: number;
    tasksCompleted: number;
    draftsCreated: number;
    mentionsFound: number;
  }>;
  totals: {
    geoRuns: number;
    geoSuccessRate: number;
    audits: number;
    avgScore: number;
    tasksCreated: number;
    tasksCompleted: number;
    draftsCreated: number;
    mentionsFound: number;
  };
  generatedAt: string;
}

export default function ProjectActivityPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/activity?days=${range}`);
      const json = await res.json();
      setData(json.data);
      setLoading(false);
    })();
  }, [projectId, range]);

  if (loading || !data) {
    return (
      <div className="card py-12 text-center">
        <span className="status-dot idle" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING ACTIVITY...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M01 · PROJECT ACTIVITY
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">活动流 + 趋势</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              ← 返回总览
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">RANGE</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`rounded border px-2 py-1 ${
                range === d
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* 累计卡片 */}
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <TotalCell label="GEO runs" value={data.totals.geoRuns} hint={`成功率 ${data.totals.geoSuccessRate}%`} />
        <TotalCell label="页面审计" value={data.totals.audits} hint={`平均 ${data.totals.avgScore}`} />
        <TotalCell label="新建任务" value={data.totals.tasksCreated} />
        <TotalCell label="完成任务" value={data.totals.tasksCompleted} hint={
          data.totals.tasksCreated > 0
            ? `完成率 ${Math.round(data.totals.tasksCompleted / data.totals.tasksCreated * 100)}%`
            : "—"
        } />
        <TotalCell label="新建草稿" value={data.totals.draftsCreated} />
        <TotalCell label="品牌提及" value={data.totals.mentionsFound} />
      </div>

      {/* 趋势图（条形图） */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // 30-DAY TIMELINE
            </div>
            <h2 className="mt-1 text-lg font-semibold">事件密度</h2>
          </div>
        </div>

        {data.series.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-muted-foreground">
            [ NO DATA IN SELECTED RANGE ]
          </div>
        ) : (
          <TimelineChart series={data.series} />
        )}
      </div>

      {/* 详细表 */}
      <div className="card overflow-x-auto">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // DETAIL TABLE
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th>DATE</th>
              <th className="w-16">GEO</th>
              <th className="w-16">SCORE</th>
              <th className="w-16">AUDIT</th>
              <th className="w-16">TASK+</th>
              <th className="w-16">TASK✓</th>
              <th className="w-16">DRAFT</th>
              <th className="w-16">MENTION</th>
            </tr>
          </thead>
          <tbody>
            {[...data.series].reverse().map((d) => (
              <tr key={d.date}>
                <td className="font-mono text-xs">{d.date}</td>
                <td className="font-mono text-xs text-center text-primary">
                  {d.geoRuns > 0 ? `${d.geoRuns}/${d.geoSuccess}` : "—"}
                </td>
                <td className="font-mono text-xs text-center">
                  {d.avgScore ?? "—"}
                </td>
                <td className="font-mono text-xs text-center">{d.audits}</td>
                <td className="font-mono text-xs text-center text-warning">{d.tasksCreated}</td>
                <td className="font-mono text-xs text-center text-success">{d.tasksCompleted}</td>
                <td className="font-mono text-xs text-center text-info">{d.draftsCreated}</td>
                <td className="font-mono text-xs text-center text-accent">{d.mentionsFound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center font-mono text-[10px] text-muted-foreground">
        GENERATED :: {new Date(data.generatedAt).toLocaleString("zh-CN", { hour12: false })}
      </div>
    </div>
  );
}

function TotalCell({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 metric-number text-2xl">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function TimelineChart({ series }: { series: ActivityData["series"] }) {
  // 计算最大事件数用于缩放
  const maxEvents = Math.max(
    1,
    ...series.map((d) =>
      d.geoRuns + d.audits + d.tasksCreated + d.draftsCreated + d.mentionsFound,
    ),
  );

  return (
    <div className="space-y-1.5">
      {series.map((d) => {
        const total = d.geoRuns + d.audits + d.tasksCreated + d.draftsCreated + d.mentionsFound;
        const widthPct = (total / maxEvents) * 100;
        return (
          <div key={d.date} className="group flex items-center gap-3">
            <div className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">
              {d.date.slice(5)}
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded border border-border bg-background/30">
              {/* 复合条：GEO + Audit + Task + Draft + Mention */}
              <div className="absolute inset-y-0 left-0 flex">
                <div
                  className="bg-primary/60 transition-all"
                  style={{ width: `${(d.geoRuns / maxEvents) * 100}%` }}
                  title={`GEO: ${d.geoRuns}`}
                />
                <div
                  className="bg-info/60 transition-all"
                  style={{ width: `${(d.audits / maxEvents) * 100}%` }}
                  title={`Audit: ${d.audits}`}
                />
                <div
                  className="bg-warning/60 transition-all"
                  style={{ width: `${(d.tasksCreated / maxEvents) * 100}%` }}
                  title={`Task+: ${d.tasksCreated}`}
                />
                <div
                  className="bg-accent/60 transition-all"
                  style={{ width: `${(d.draftsCreated / maxEvents) * 100}%` }}
                  title={`Draft: ${d.draftsCreated}`}
                />
                <div
                  className="bg-success/60 transition-all"
                  style={{ width: `${(d.mentionsFound / maxEvents) * 100}%` }}
                  title={`Mention: ${d.mentionsFound}`}
                />
              </div>
              {/* 分数标记 */}
              {d.avgScore !== null && (
                <div className="absolute inset-y-0 right-2 flex items-center font-mono text-[10px] font-bold text-foreground">
                  {d.avgScore}
                </div>
              )}
            </div>
            <div className="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              {total} 事件
            </div>
          </div>
        );
      })}

      {/* 图例 */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-3 text-[10px] font-mono uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-primary/60" /> GEO
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-info/60" /> AUDIT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-warning/60" /> TASK+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-accent/60" /> DRAFT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-success/60" /> MENTION
        </span>
      </div>
    </div>
  );
}