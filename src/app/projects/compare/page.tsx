"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CompareRow {
  project: {
    id: string;
    name: string;
    domain: string;
    primaryBrand: string;
    status: string;
    geoDailyEnabled: boolean;
  };
  resources: {
    keywords: number;
    geoQuestions: number;
    brands: number;
    competitors: number;
    pages: number;
  };
  tasks: { open: number };
  geo: {
    totalRuns: number;
    successRuns: number;
    successRate: number;
    score: number;
    brandMentioned: number;
    trend: string;
  };
  seo: { avgScore: number };
  createdAt: string;
}

const TREND_ICON: Record<string, string> = {
  up: "▲",
  down: "▼",
  stable: "—",
};
const TREND_COLOR: Record<string, string> = {
  up: "text-success",
  down: "text-destructive",
  stable: "text-muted-foreground",
};

export default function ComparePage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; domain: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<CompareRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      const list = (json.data ?? []) as Array<{ id: string; name: string; domain: string; status: string }>;
      setProjects(list.filter((p) => p.status === "ACTIVE"));
      // 默认选前 3 个
      setSelected(list.filter((p) => p.status === "ACTIVE").slice(0, 3).map((p) => p.id));
    })();
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    void (async () => {
      const res = await fetch(`/api/projects/compare?ids=${selected.join(",")}`);
      const json = await res.json();
      setData(json.data?.projects ?? null);
      setLoading(false);
    })();
  }, [selected]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 10 ? [...prev, id] : prev,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // M01 · PROJECT COMPARE
        </div>
        <h1 className="text-3xl font-semibold">
          <span className="text-gradient">多项目对比</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          选 2-10 个项目横向比较资源、任务、GEO 评分
        </p>
      </div>

      {/* 选择器 */}
      <div className="card">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // SELECTED ({selected.length}/10)
        </div>
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-all ${
                selected.includes(p.id)
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {selected.includes(p.id) ? "✓ " : ""}
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card py-12 text-center">
          <span className="status-dot idle" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING COMPARISON...</span>
        </div>
      ) : data && data.length > 0 ? (
        <>
          {/* 项目信息对比 */}
          <div className="card overflow-x-auto">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // OVERVIEW
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th>METRIC</th>
                  {data.map((d) => (
                    <th key={d.project.id} className="text-center min-w-32">
                      <Link
                        href={`/projects/${d.project.id}`}
                        className="hover:text-primary"
                      >
                        {d.project.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="域名" values={data.map((d) => d.project.domain)} />
                <CompareRow label="主品牌" values={data.map((d) => d.project.primaryBrand)} />
                <CompareRow label="状态" values={data.map((d) => d.project.status)} highlight={(v) => v === "ACTIVE" ? "success" : "warning"} />
                <CompareRow
                  label="每日 GEO 监测"
                  values={data.map((d) => d.project.geoDailyEnabled ? "✓ 启用" : "✗ 停用")}
                  highlight={(v) => String(v).includes("✓") ? "success" : "warning"}
                />
                <CompareRow
                  label="创建时间"
                  values={data.map((d) => new Date(d.createdAt).toLocaleDateString("zh-CN"))}
                />
              </tbody>
            </table>
          </div>

          {/* 资源对比 */}
          <div className="card overflow-x-auto">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // RESOURCES
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th>COUNT</th>
                  {data.map((d) => <th key={d.project.id} className="text-center min-w-32">{d.project.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="关键词" values={data.map((d) => d.resources.keywords)} highlight={(v) => Number(v) >= 5 ? "success" : Number(v) >= 1 ? "warning" : "destructive"} />
                <CompareRow label="GEO 问题" values={data.map((d) => d.resources.geoQuestions)} highlight={(v) => Number(v) >= 3 ? "success" : Number(v) >= 1 ? "warning" : "destructive"} />
                <CompareRow label="品牌" values={data.map((d) => d.resources.brands)} highlight={(v) => Number(v) >= 1 ? "success" : "warning"} />
                <CompareRow label="竞品" values={data.map((d) => d.resources.competitors)} />
                <CompareRow label="已抓取页面" values={data.map((d) => d.resources.pages)} />
              </tbody>
            </table>
          </div>

          {/* GEO 对比 */}
          <div className="card overflow-x-auto">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // GEO PERFORMANCE
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th>METRIC</th>
                  {data.map((d) => <th key={d.project.id} className="text-center min-w-32">{d.project.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="GEO 评分"
                  values={data.map((d) => `${d.geo.score}/100`)}
                  highlight={(v) => {
                    const n = parseInt(String(v));
                    return n >= 60 ? "success" : n >= 30 ? "warning" : "destructive";
                  }}
                  renderBar={(v) => {
                    const n = parseInt(String(v).split("/")[0]);
                    return <BarCell value={n} />;
                  }}
                />
                <CompareRow
                  label="趋势"
                  values={data.map((d) => ({ text: TREND_ICON[d.geo.trend], color: TREND_COLOR[d.geo.trend] }))}
                />
                <CompareRow
                  label="总 runs"
                  values={data.map((d) => d.geo.totalRuns)}
                />
                <CompareRow
                  label="成功率"
                  values={data.map((d) => `${d.geo.successRate}%`)}
                  highlight={(v) => {
                    const s = String(v).replace("%", "");
                    const n = parseInt(s);
                    return n >= 80 ? "success" : n >= 50 ? "warning" : "destructive";
                  }}
                />
                <CompareRow
                  label="主品牌提及"
                  values={data.map((d) => d.geo.brandMentioned)}
                />
                <CompareRow
                  label="待处理任务"
                  values={data.map((d) => d.tasks.open)}
                  highlight={(v) => Number(v) === 0 ? "success" : Number(v) > 10 ? "destructive" : "warning"}
                />
              </tbody>
            </table>
          </div>

          {/* SEO 对比 */}
          <div className="card overflow-x-auto">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              // SEO
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th>METRIC</th>
                  {data.map((d) => <th key={d.project.id} className="text-center min-w-32">{d.project.name}</th>)}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="平均 SEO 分"
                  values={data.map((d) => `${d.seo.avgScore}/100`)}
                  highlight={(v) => {
                    const n = parseInt(String(v).split("/")[0]);
                    return n >= 70 ? "success" : n >= 40 ? "warning" : "destructive";
                  }}
                  renderBar={(v) => {
                    const n = parseInt(String(v).split("/")[0]);
                    return <BarCell value={n} />;
                  }}
                />
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card py-12 text-center font-mono text-xs text-muted-foreground">
          [ SELECT AT LEAST 2 PROJECTS ]
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  values,
  highlight,
  renderBar,
}: {
  label: string;
  values: Array<string | number | { text: string; color: string }>;
  highlight?: (v: string | number) => "success" | "warning" | "destructive" | undefined;
  renderBar?: (v: string | number) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="font-mono text-xs text-muted-foreground uppercase">{label}</td>
      {values.map((v, i) => {
        let display: React.ReactNode;
        let colorClass = "";
        if (typeof v === "object") {
          display = <span className={`font-mono ${v.color}`}>{v.text}</span>;
        } else {
          display = <span className="font-mono text-sm">{String(v)}</span>;
          if (highlight) {
            const sev = highlight(v);
            if (sev === "success") colorClass = "text-success";
            else if (sev === "warning") colorClass = "text-warning";
            else if (sev === "destructive") colorClass = "text-destructive";
          }
        }
        return (
          <td key={i} className={`text-center ${colorClass}`}>
            {display}
            {renderBar && typeof v === "number" && (
              <div className="mt-1">{renderBar(v)}</div>
            )}
            {renderBar && typeof v === "string" && (
              <div className="mt-1">{renderBar(v)}</div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function BarCell({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mx-auto h-1.5 w-20 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full ${
          pct >= 60 ? "bg-success" : pct >= 30 ? "bg-warning" : "bg-destructive"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}