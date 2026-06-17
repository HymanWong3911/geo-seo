"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface GeoQuestion {
  id: string;
  question: string;
  language: string;
  region: string;
  intent: string;
  priority: number;
  active: boolean;
  keywordIds: string[];
}

const INTENTS = [
  "INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL", "LOCAL", "COMPARISON",
] as const;

const PRIORITY_BADGE: Record<number, string> = {
  1: "badge-error",
  2: "badge-warning",
  3: "badge-muted",
  4: "badge-info",
  5: "badge-success",
};

export default function GeoPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [questions, setQuestions] = useState<GeoQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { t } = useI18n();

  async function load() {
    if (!projectId) { setQuestions([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/geo/questions`);
    const json = await res.json();
    setQuestions(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive(q: GeoQuestion) {
    const res = await fetch(`/api/geo/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    if (res.ok) {
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, active: !q.active } : x)));
    }
  }

  async function handleDelete(q: GeoQuestion) {
    if (!confirm(`confirm_delete("${q.question.slice(0, 40)}...")?`)) return;
    const res = await fetch(`/api/geo/questions/${q.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const activeCount = questions.filter(q => q.active).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M07 — GEO Questions</div>
          <h1 className="mt-2">GEO Question Bank</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + new_question
            </button>
          )}
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.geo}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          {!loading && questions.length > 0 && (
            <div className="mb-8 grid grid-cols-3 gap-px bg-border">
              <div className="cell">
                <div className="eyebrow">total_questions</div>
                <div className="metric-number-sm mt-1">{questions.length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">active</div>
                <div className="metric-number-sm mt-1 text-success">{activeCount}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">inactive</div>
                <div className="metric-number-sm mt-1">{questions.length - activeCount}</div>
              </div>
            </div>
          )}

          {/* 表格 */}
          {loading ? (
            <SkeletonTable rows={6} />
          ) : questions.length === 0 ? (
            <div className="empty-state">
              [ no_questions ] — add questions to track GEO visibility
            </div>
          ) : (
            <div className="border border-border">
              <table>
                <thead>
                  <tr>
                    <th>question</th>
                    <th className="w-28">intent</th>
                    <th className="w-20">priority</th>
                    <th className="w-32">lang/region</th>
                    <th className="w-20">status</th>
                    <th className="w-28">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} className={`group ${!q.active ? "opacity-50" : ""}`}>
                      <td>
                        <div className="text-sm leading-relaxed">{q.question}</div>
                      </td>
                      <td>
                        <span className="chip">{q.intent}</span>
                      </td>
                      <td>
                        <span className={`badge ${PRIORITY_BADGE[q.priority] ?? "badge-muted"}`}>
                          P{q.priority}
                        </span>
                      </td>
                      <td className="mono-line text-xs">
                        {q.language}/{q.region}
                      </td>
                      <td>
                        <button
                          onClick={() => void toggleActive(q)}
                          className={`badge ${q.active ? "badge-success" : "badge-muted"} cursor-pointer`}
                        >
                          <span className={`status-dot ${q.active ? "online" : "idle"}`} />
                          {q.active ? "active" : "inactive"}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => void toggleActive(q)}
                            className="btn-icon text-[10px]"
                            title={q.active ? "disable" : "enable"}
                          >
                            ↺
                          </button>
                          <button
                            onClick={() => void handleDelete(q)}
                            className="btn-icon text-[10px]"
                            title="delete"
                          >
                            ×
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

      {showAdd && projectId && (
        <AddQuestionDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); void load(); }}
        />
      )}
    </div>
  );
}

function AddQuestionDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    question: "",
    intent: "INFORMATIONAL",
    priority: 3,
    language: "zh",
    region: "CN",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/geo/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json?.error?.message ?? "create_failed"); return; }
    onAdded();
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-panel">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">// M07 — New Question</div>
              <h2 className="mt-1">Add GEO Question</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="mono-line block mb-2">question *</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <textarea
                required
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                rows={3}
                className="flex-1 bg-transparent outline-none text-sm resize-none"
                placeholder="What are the best SEO optimization tools for enterprise teams?"
                autoFocus
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-line block mb-2">intent</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <select value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}>
                  {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mono-line block mb-2">priority (1-5)</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="number" min={1} max={5} value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-line block mb-2">language</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="text" value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  placeholder="zh" />
              </div>
            </div>
            <div>
              <label className="mono-line block mb-2">region</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="text" value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="CN" />
              </div>
            </div>
          </div>
          {error && (
            <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
              [ error ] {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">cancel</button>
            <button type="submit" disabled={loading} className="btn-primary btn-sm">
              {loading ? "creating..." : "create →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
