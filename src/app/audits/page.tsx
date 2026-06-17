"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface PageAudit {
  id: string;
  score: number;
  statusCode: number | null;
  indexable: boolean | null;
  createdAt: string;
  page: {
    id: string;
    url: string;
    title: string | null;
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

  async function load() {
    setLoading(true);
    // 默认拉所有项目的最近审计（ADMIN）或当前项目的（MEMBER）
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
      body: JSON.stringify({ url, sync: true }),  // dev 默认同步
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setResult(json?.error?.message ?? "审计失败");
      return;
    }
    setResult(
      `审计完成！分数 ${json.data.score}，问题数 ${json.data.findingsCount}`,
    );
    setUrl("");
    void load();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="eyebrow">// M02 — Page Audits</div>
          <h1 className="mt-2 text-2xl tracking-tight">Audits</h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary shrink-0"
        >
          + new_audit
        </button>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.audits}</p>

      <div className="border border-border">
        {loading ? (
          <div className="p-12 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <span className="status-dot idle" /> loading
          </div>
        ) : audits.length === 0 ? (
          <div className="p-12 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            [ no audits ] — click + new_audit to start
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>//id</th>
                <th>page</th>
                <th className="w-24">score</th>
                <th className="w-32">status</th>
                <th className="w-48">timestamp</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-[10px] text-muted-foreground">
                    {a.id.slice(-8)}
                  </td>
                  <td>
                    <Link href={`/audits/${a.id}`} className="text-foreground hover:text-primary">
                      {a.page.title ?? a.page.url}
                    </Link>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {a.page.url}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        a.score >= 80
                          ? "badge-success"
                          : a.score >= 60
                            ? "badge-warning"
                            : "badge-error"
                      }`}
                    >
                      <span
                        className={`status-dot ${
                          a.score >= 80
                            ? "online"
                            : a.score >= 60
                              ? "warning"
                              : "error"
                        }`}
                      />
                      {String(a.score).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="font-mono text-xs">
                    <span className="text-foreground">{a.statusCode ?? "—"}</span>
                    <span className="ml-2 text-muted-foreground">
                      {a.indexable ? "index" : "noindex"}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && (setShowNew(false), setResult(null))}>
          <form
            onSubmit={handleSubmit}
            className="dialog-panel p-8 space-y-8"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="eyebrow">// M02 — New Diagnostic</div>
                <h2 className="mt-2 text-lg">Audit Page</h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowNew(false); setResult(null); }}
                className="btn-icon">×</button>
            </div>
            <div>
              <label className="mono-line block mb-2">project_id *</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input
                  type="text"
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="flex-1"
                  placeholder="clxxx..." />
              </div>
            </div>
            <div>
              <label className="mono-line block mb-2">url *</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                  placeholder="https://example.com/page" />
              </div>
            </div>
            {result && (
              <div className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] ${
                result.includes("完成")
                  ? "border-success/50 bg-success/5 text-success"
                  : "border-destructive/50 bg-destructive/5 text-destructive"
              }`}>
                [ status ] {result}
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => { setShowNew(false); setResult(null); }}
                className="btn-ghost btn-sm">cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary btn-sm">
                {submitting ? "scanning..." : "execute →"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
