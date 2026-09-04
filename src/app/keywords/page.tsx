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
    if (!confirm(`确认删除关键词「${k.text}」？`)) return;
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
          <div className="eyebrow">// M06 — 关键词</div>
          <h1 className="mt-2">关键词</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + 添加关键词
            </button>
          )}
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.keywords}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> 请先选择一个项目
        </div>
      ) : (
        <>
          {/* 搜索 + 批量操作 */}
          <div className="mb-6 flex items-center gap-3">
            <div className="input-field flex-1">
              <span className="input-field-icon">›</span>
              <input
                type="search"
                placeholder="搜索关键词..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
              />
            </div>
            <button onClick={() => void load()} className="btn-ghost btn-sm">搜索</button>
            <button onClick={() => setShowImport(true)} className="btn-ghost btn-sm">导入CSV</button>
          </div>

          {/* 统计摘要 */}
          {!loading && keywords.length > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-px bg-border">
              <div className="cell">
                <div className="eyebrow">总数</div>
                <div className="metric-number-sm mt-1">{keywords.length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">高优先级</div>
                <div className="metric-number-sm mt-1">{keywords.filter(k => k.priority <= 2).length}</div>
              </div>
              <div className="cell">
                <div className="eyebrow">平均难度</div>
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
              [ 暂无关键词 ] — 添加关键词以开始跟踪
            </div>
          ) : (
            <div className="border border-border">
              <table>
                <thead>
                  <tr>
                    <th>关键词</th>
                    <th>意图</th>
                    <th className="w-20">优先级</th>
                    <th>语言/地区</th>
                    <th>目标URL</th>
                    <th className="w-24">操作</th>
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
              <div className="eyebrow">// M06 — 新建关键词</div>
              <h2 className="mt-1">添加关键词</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="mono-line block mb-2">关键词 *</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <input type="text" required value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="输入关键词，如：企业管理咨询" autoFocus />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-line block mb-2">搜索意图</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <select value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}>
                  {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mono-line block mb-2">优先级 (1-5)</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="number" min={1} max={5} value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <div>
            <label className="mono-line block mb-2">目标URL (可选)</label>
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
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">取消</button>
            <button type="submit" disabled={loading} className="btn-primary btn-sm">
              {loading ? "创建中..." : "创建 →"}
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
              <div className="eyebrow">// M06 — 批量导入</div>
              <h2 className="mt-1">导入关键词</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="rounded border border-border bg-card p-3 font-mono text-[10px] text-muted-foreground leading-relaxed">
            CSV格式：text (必填), intent (可选), priority 1-5 (可选，默认3)
          </div>
          <div>
            <label className="mono-line block mb-2">CSV数据</label>
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
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">取消</button>
            <button type="submit" disabled={loading} className="btn-primary btn-sm">
              {loading ? "导入中..." : "导入 →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
