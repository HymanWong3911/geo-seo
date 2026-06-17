"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface GeoRun {
  id: string;
  triggerType: string;
  provider: string;
  model: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL_FAILURE";
  questionIds: string[];
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  _count: { results: number };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "border-muted-foreground/30 bg-muted text-muted-foreground",
  RUNNING: "border-info/30 bg-info/10 text-info",
  SUCCESS: "border-success/30 bg-success/10 text-success",
  PARTIAL_FAILURE: "border-warning/30 bg-warning/10 text-warning",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_ICON: Record<string, string> = {
  PENDING: "idle",
  RUNNING: "warning",
  SUCCESS: "online",
  PARTIAL_FAILURE: "warning",
  FAILED: "error",
};

export default function GeoRunsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [runs, setRuns] = useState<GeoRun[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects(json.data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/geo/runs?pageSize=50`);
      const json = await res.json();
      setRuns(json.data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M04 · GEO MONITOR RUNS
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">GEO 运行历史</span>
          </h1>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.geoRuns}</p>

      <div className="card">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            PROJECT
          </span>
          <select
            value={projectId}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("projectId", e.target.value);
              window.history.replaceState({}, "", url);
              // 触发刷新
              window.location.reload();
            }}
            className="rounded-md border border-input bg-background/50 px-3 py-1.5 font-mono text-sm"
          >
            <option value="">— SELECT —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {projectId && (
            <Link
              href={`/geo?projectId=${projectId}`}
              className="ml-auto font-mono text-xs text-primary hover:underline"
            >
              ← 返回 GEO 监测
            </Link>
          )}
        </div>

        {!projectId ? (
          <div className="py-12 text-center font-mono text-xs text-muted-foreground">
            [ SELECT A PROJECT ]
          </div>
        ) : loading ? (
          <div className="py-12 text-center">
            <span className="status-dot idle" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-muted-foreground">
            [ NO RUNS YET ] — 去 /geo 触发一次
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>TRIGGER</th>
                  <th>PROVIDER</th>
                  <th className="w-20">QUESTIONS</th>
                  <th className="w-20">RESULTS</th>
                  <th className="w-44">STARTED</th>
                  <th className="w-44">FINISHED</th>
                  <th className="w-16">RETRY</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] ${
                          STATUS_COLOR[r.status] ?? "border-border bg-muted text-foreground"
                        }`}
                      >
                        <span className={`status-dot ${STATUS_ICON[r.status]}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      <span className="text-foreground">{r.triggerType}</span>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {r.provider}/{r.model}
                    </td>
                    <td className="font-mono text-xs text-center">
                      {r.questionIds.length}
                    </td>
                    <td className="font-mono text-xs text-center text-primary">
                      {r._count.results}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {r.startedAt ? new Date(r.startedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {r.finishedAt ? new Date(r.finishedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                    </td>
                    <td className="font-mono text-xs text-center">
                      {r.retryCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
