"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface Keyword {
  id: string;
  text: string;
  language: string;
  region: string;
  intent: string;
  priority: number;
  targetUrl: string | null;
  searchVolume?: number;
  difficulty?: number;
}

const INTENTS = [
  "INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL", "LOCAL", "COMPARISON",
] as const;

const PRIORITY_COLOR: Record<number, string> = {
  1: "badge-error",
  2: "badge-warning",
  3: "badge-muted",
  4: "badge-info",
  5: "badge-success",
};

export default function KeywordsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { t } = useI18n();

  async function load() {
    if (!projectId) { setKeywords([]); return; }
    setLoading(true);
    const url = new URL(`/api/projects/${projectId}/keywords`, window.location.origin);
    if (search) url.searchParams.set("search", search);
    const res = await fetch(url);
    const json = await res.json();
    setKeywords(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(k: Keyword) {
    if (!confirm(`confirm_delete("${k.text}")?`)) return;
    const res = await fetch(`/api/keywords/${k.id}`, { method: "DELETE" });
    if (res.ok) void load();
    else {
      const json = await res.json();
      alert(json?.error?.message ?? "delete_failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M06 — Keywords</div>
          <h1 className="mt-2">Keywords</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + new_kw
            </button>
          )}
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.keywords}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : (
        <>
          {/* 搜索 + 批量操作 */}
          <div className="mb-6 flex items-center gap-3">
            <div className="input-field flex-1">
              <span className="input-field-icon">›</span>
              <input
                type="search"
                placeholder="search keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
              />
            </div>
            <button onClick={() => void load()} className="btn-ghost btn-sm">search</button>
            <button onClick={() => setShowImport(true)} className="btn-ghost btn-sm">import_csv</button>
          </div>

          {/* 统计摘要 */}
          {!loading && keywords.length > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-px bg-border">
              <div className="cell">
                <div className="eyebrow">total</div>
                <div className="metric-number-sm mt-1">{keywords.length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">high_priority</div>
                <div className="metric-number-sm mt-1">{keywords.filter(k => k.priority <= 2).length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">avg_difficulty</div>
                <div className="metric-number-sm mt-1">
                  {keywords.filter(k => k.difficulty != null).length > 0
                    ? Math.round(keywords.reduce((s, k) => s + (k.difficulty ?? 0), 0) / keywords.filter(k => k.difficulty != null).length)
                    : "—"}
                </div>
              </div>
            </div>
          )}

          {/* 表格 */}
          {loading ? (
            <SkeletonTable rows={6} />
          ) : keywords.length === 0 ? (
            <div className="empty-state">
              [ no_keywords ] — add keywords to track
            </div>
          ) : (
            <div className="border border-border">
              <table>
                <thead>
                  <tr>
                    <th>keyword</th>
                    <th>intent</th>
                    <th className="w-20">priority</th>
                    <th>lang/region</th>
                    <th>target_url</th>
                    <th className="w-24">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((k) => (
                    <tr key={k.id} className="group">
                      <td>
                        <button
                          onClick={() => setExpandedId(expandedId === k.id ? null : k.id)}
                          className="flex items-center gap-2 text-left"
                        >
                          <span className="font-medium text-foreground">{k.text}</span>
                          {k.searchVolume != null && (
                            <span className="mono-line text-[10px]">
                              vol:{k.searchVolume.toLocaleString()}
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        <span className="chip">{k.intent}</span>
                      </td>
                      <td>
                        <span className={`badge ${PRIORITY_COLOR[k.priority] ?? "badge-muted"}`}>
                          P{k.priority}
                        </span>
                      </td>
                      <td className="mono-line text-xs">
                        {k.language}/{k.region}
                      </td>
                      <td className="mono-line text-xs text-muted-foreground">
                        {k.targetUrl ?? "—"}
                      </td>
                      <td>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => void handleDelete(k)}
                            className="btn-icon text-[10px]"
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

      {showAdd && (
        <AddKeywordDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); void load(); }}
        />
      )}
      {showImport && (
        <ImportDialog
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); void load(); }}
        />
      )}
    </div>
  );
}

function AddKeywordDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ text: "", intent: "INFORMATIONAL", priority: 3, targetUrl: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const body: Record<string, unknown> = { ...form };
    if (!form.targetUrl) delete body.targetUrl;
    const res = await fetch(`/api/projects/${projectId}/keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
              <div className="eyebrow">// M06 — New Keyword</div>
              <h2 className="mt-1">Add Keyword</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="mono-line block mb-2">keyword *</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <input type="text" required value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="SEO optimization tool" autoFocus />
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
          <div>
            <label className="mono-line block mb-2">target_url (optional)</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <input type="url" value={form.targetUrl}
                onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                placeholder="https://example.com/topic" />
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

function ImportDialog({ projectId, onClose, onImported }: { projectId: string; onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState(`text,intent,priority
SEO optimization tool,INFORMATIONAL,1
GEO monitoring,COMMERCIAL,2
keyword research,INFORMATIONAL,3`);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/keywords/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "csv", csv: text }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json?.error?.message ?? "import_failed"); return; }
    onImported();
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-panel">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">// M06 — Bulk Import</div>
              <h2 className="mt-1">Import Keywords</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="rounded border border-border bg-card p-3 font-mono text-[10px] text-muted-foreground leading-relaxed">
            csv_format :: text (required), intent (optional), priority 1-5 (optional, default 3)
          </div>
          <div>
            <label className="mono-line block mb-2">csv_data</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="input-full font-mono text-xs"
              style={{ resize: "vertical" }}
            />
          </div>
          {error && (
            <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
              [ error ] {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">cancel</button>
            <button type="submit" disabled={loading} className="btn-primary btn-sm">
              {loading ? "importing..." : "import →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
