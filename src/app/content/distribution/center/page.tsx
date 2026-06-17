"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Overview {
  days: number;
  totals: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    successRate: number;
  };
  byProject: Array<{
    project: { id: string; name: string; domain: string };
    total: number;
    success: number;
    failed: number;
    pending: number;
  }>;
  byPlatform: Array<{
    platform: string;
    total: number;
    success: number;
    successRate: number;
  }>;
  recent: Array<{
    id: string;
    status: string;
    attempts: number;
    externalUrl: string | null;
    externalId: string | null;
    errorMessage: string | null;
    createdAt: string;
    sentAt: string | null;
    target: {
      id: string;
      name: string;
      platform: string;
      project: { id: string; name: string; domain: string };
    };
    draft: { id: string; title: string; status: string } | null;
  }>;
  generatedAt: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  ZHIHU: "知乎",
  WECHAT_MP: "微信公众号",
  FEISHU_DOC: "飞书文档",
  NOTION: "Notion",
  CUSTOM_WEBHOOK: "Webhook",
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: "border-success/30 bg-success/10 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  PENDING: "border-warning/30 bg-warning/10 text-warning",
};

export default function DistributionCenterPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [filter, setFilter] = useState<"all" | "SUCCESS" | "FAILED" | "PENDING">("all");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/distribution/overview?days=${range}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [range]);

  async function retry(logId: string) {
    const res = await fetch(`/api/distribution-logs/${logId}/retry`, { method: "POST" });
    if (res.ok) {
      await load();
    } else {
      const json = await res.json();
      alert(json?.error?.message ?? "重试失败");
    }
  }

  const filtered = data
    ? filter === "all"
      ? data.recent
      : data.recent.filter((r) => r.status === filter)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M10 · DISTRIBUTION CENTER
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">内容分发中心</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            跨平台分发的统一视图 + 重试控制台
          </p>
        </div>
        <div className="flex gap-2 font-mono text-xs">
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

      {loading || !data ? (
        <div className="card py-12 text-center">
          <span className="status-dot idle" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING...</span>
        </div>
      ) : (
        <>
          {/* 顶部指标 */}
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="总分发" value={data.totals.total} />
            <MetricCell
              label="成功"
              value={data.totals.success}
              tone="success"
              hint={`${data.totals.successRate}% 成功率`}
            />
            <MetricCell
              label="失败"
              value={data.totals.failed}
              tone="destructive"
            />
            <MetricCell
              label="进行中"
              value={data.totals.pending}
              tone="warning"
            />
          </div>

          {/* 按项目 + 按平台 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                // BY PROJECT
              </div>
              {data.byProject.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-muted-foreground">[ NO DATA ]</div>
              ) : (
                <div className="space-y-2">
                  {data.byProject.map((p) => (
                    <Link
                      key={p.project.id}
                      href={`/projects/${p.project.id}`}
                      className="flex items-center gap-3 rounded border border-border bg-background/30 p-2 transition-all hover:border-primary"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{p.project.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p.project.domain}</div>
                      </div>
                      <div className="flex gap-2 font-mono text-xs">
                        <span className="text-success">{p.success}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-destructive">{p.failed}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-warning">{p.pending}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                // BY PLATFORM
              </div>
              {data.byPlatform.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-muted-foreground">[ NO DATA ]</div>
              ) : (
                <div className="space-y-2">
                  {data.byPlatform.map((p) => (
                    <div key={p.platform} className="flex items-center gap-3">
                      <div className="w-32 font-mono text-xs text-muted-foreground">
                        {PLATFORM_LABEL[p.platform] ?? p.platform}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-success"
                            style={{ width: `${p.successRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right font-mono text-xs">
                        <span className="text-success">{p.success}</span>
                        <span className="text-muted-foreground">/{p.total}</span>
                      </div>
                      <div className="w-12 text-right font-mono text-[10px] text-muted-foreground">
                        {p.successRate}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 最近日志 */}
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  // RECENT LOGS
                </div>
                <h2 className="mt-1 text-lg font-semibold">分发日志</h2>
              </div>
              <div className="flex gap-1">
                {(["all", "SUCCESS", "PENDING", "FAILED"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded border px-2 py-1 font-mono text-[10px] ${
                      filter === f
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                [ NO LOGS MATCHING FILTER ]
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>STATUS</th>
                      <th>PROJECT</th>
                      <th>TARGET</th>
                      <th>DRAFT</th>
                      <th className="w-32">ATTEMPTS</th>
                      <th className="w-44">TIME</th>
                      <th>RESULT / ERROR</th>
                      <th className="w-20">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] ${
                              STATUS_COLOR[r.status] ?? "border-border bg-muted text-foreground"
                            }`}
                          >
                            <span
                              className={`status-dot ${
                                r.status === "SUCCESS" ? "online" : r.status === "FAILED" ? "error" : "warning"
                              }`}
                            />
                            {r.status}
                          </span>
                        </td>
                        <td className="font-mono text-xs">{r.target.project.name}</td>
                        <td>
                          <div className="font-mono text-xs">{r.target.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {PLATFORM_LABEL[r.target.platform] ?? r.target.platform}
                          </div>
                        </td>
                        <td className="max-w-xs truncate">
                          {r.draft ? (
                            <Link href={`/content/drafts/${r.draft.id}?projectId=${r.target.project.id}`} className="text-xs hover:text-primary">
                              {r.draft.title}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="font-mono text-xs text-center">×{r.attempts}</td>
                        <td className="font-mono text-xs text-muted-foreground">
                          {(r.sentAt ?? r.createdAt).slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="max-w-sm text-xs">
                          {r.status === "SUCCESS" && r.externalUrl && (
                            <a
                              href={r.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-primary hover:underline"
                            >
                              {r.externalUrl.slice(0, 50)}
                            </a>
                          )}
                          {r.status === "FAILED" && r.errorMessage && (
                            <span className="font-mono text-destructive">
                              {r.errorMessage.slice(0, 80)}
                            </span>
                          )}
                          {r.status === "PENDING" && (
                            <span className="font-mono text-muted-foreground">in progress...</span>
                          )}
                        </td>
                        <td>
                          {r.status === "FAILED" && (
                            <button
                              onClick={() => void retry(r.id)}
                              className="font-mono text-[10px] text-warning hover:underline"
                            >
                              RETRY →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 metric-number text-2xl">{value}</div>
    </div>
  );
}

function MetricCell({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone: "success" | "destructive" | "warning" }) {
  const toneColor = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
  }[tone];
  return (
    <div className="card">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 metric-number text-2xl ${toneColor}`}>{value}</div>
      {hint && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}