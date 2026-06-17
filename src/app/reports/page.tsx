"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface Report {
  id: string;
  type: "WEEKLY" | "MONTHLY" | "AUDIT";
  periodFrom: string;
  periodTo: string;
  auditId: string | null;
  generatedBy: string | null;
  createdAt: string;
}

const TYPE_BADGE: Record<Report["type"], string> = {
  WEEKLY: "badge-gold",
  MONTHLY: "badge-info",
  AUDIT: "badge-muted",
};
const TYPE_LABEL: Record<Report["type"], string> = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  AUDIT: "audit",
};

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const { t } = useI18n();

  async function load() {
    if (!projectId) { setReports([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/reports`);
    const json = await res.json();
    setReports(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(type: "WEEKLY" | "MONTHLY", fromDays: number) {
    if (!projectId) return;
    setError("");
    setGenerating(true);
    const res = await fetch(`/api/projects/${projectId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, fromDays }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) { setError(json?.error?.message ?? "generation_failed"); return; }
    setShowGenerate(false);
    void load();
  }

  function viewReport(r: Report) {
    window.open(`/api/reports/${r.id}`, "_blank");
  }

  async function downloadReport(r: Report, format: "md" | "pdf") {
    setDownloading(r.id);
    try {
      const res = await fetch(`/api/reports/${r.id}?format=${format}`);
      if (!res.ok) throw new Error("Download failed");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${r.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M15 — Reports</div>
          <h1 className="mt-2">Reports</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowGenerate(true)} className="btn-primary">
              + generate
            </button>
          )}
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.reports}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : (
        <>
          {/* 统计 */}
          {!loading && reports.length > 0 && (
            <div className="mb-8 grid grid-cols-3 gap-px bg-border">
              <div className="cell">
                <div className="eyebrow">total</div>
                <div className="metric-number-sm mt-1">{reports.length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">weekly</div>
                <div className="metric-number-sm mt-1">{reports.filter(r => r.type === "WEEKLY").length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">monthly</div>
                <div className="metric-number-sm mt-1">{reports.filter(r => r.type === "MONTHLY").length}</div>
              </div>
            </div>
          )}

          {/* 表格 */}
          {loading ? (
            <SkeletonTable rows={5} />
          ) : reports.length === 0 ? (
            <div className="empty-state">
              [ no_reports ] — click + generate to create your first report
            </div>
          ) : (
            <div className="border border-border">
              <table>
                <thead>
                  <tr>
                    <th>type</th>
                    <th>period</th>
                    <th>generated</th>
                    <th className="w-48">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="group">
                      <td>
                        <span className={`badge ${TYPE_BADGE[r.type]}`}>
                          {TYPE_LABEL[r.type]}
                        </span>
                      </td>
                      <td className="mono-line text-xs">
                        {new Date(r.periodFrom).toLocaleDateString()} ~ {new Date(r.periodTo).toLocaleDateString()}
                      </td>
                      <td className="mono-line text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString("zh-CN", { hour12: false })}
                      </td>
                      <td>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => viewReport(r)} className="btn-ghost btn-sm">view</button>
                          <button 
                            onClick={() => void downloadReport(r, "md")} 
                            className="btn-ghost btn-sm"
                            disabled={downloading === r.id}
                          >
                            MD
                          </button>
                          <button 
                            onClick={() => void downloadReport(r, "pdf")} 
                            className="btn-primary btn-sm"
                            disabled={downloading === r.id}
                          >
                            {downloading === r.id ? "..." : "PDF"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 生成对话框 */}
      {showGenerate && (
        <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && setShowGenerate(false)}>
          <div className="dialog-panel">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">// M15 — Generate Report</div>
                  <h2 className="mt-1">New Report</h2>
                </div>
                <button onClick={() => setShowGenerate(false)} className="btn-icon">×</button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {error && (
                <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 font-mono text-[10px] uppercase text-destructive">
                  [ error ] {error}
                </div>
              )}
              <button
                onClick={() => void generate("WEEKLY", 7)}
                disabled={generating}
                className="card card-glow w-full p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Weekly Report</div>
                    <div className="mono-line text-[10px] mt-1">7-day SEO/GEO/task/LLM cost summary</div>
                  </div>
                  <span className="badge badge-gold">weekly</span>
                </div>
              </button>
              <button
                onClick={() => void generate("MONTHLY", 30)}
                disabled={generating}
                className="card card-glow w-full p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Monthly Report</div>
                    <div className="mono-line text-[10px] mt-1">30-day + 4-week trend + top issues</div>
                  </div>
                  <span className="badge badge-info">monthly</span>
                </div>
              </button>
              <div className="pt-2 text-right">
                <button onClick={() => setShowGenerate(false)} className="btn-ghost btn-sm">cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
