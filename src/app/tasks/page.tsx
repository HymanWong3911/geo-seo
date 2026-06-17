"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { SkeletonTable } from "@/components/ui/Skeleton";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "DOING" | "REVIEW" | "DONE" | "IGNORED";
  sourceType: string;
  sourceId: string | null;
  url: string | null;
  priority: number;
  assignee: string | null;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string; domain: string };
}

const STATUS_LABEL: Record<Task["status"], string> = {
  TODO: "todo",
  DOING: "doing",
  REVIEW: "review",
  DONE: "done",
  IGNORED: "ignored",
};

const STATUS_BADGE: Record<Task["status"], string> = {
  TODO: "badge-warning",
  DOING: "badge-info",
  REVIEW: "badge-gold",
  DONE: "badge-success",
  IGNORED: "badge-muted",
};

const STATUSES: Task["status"][] = ["TODO", "DOING", "REVIEW", "DONE", "IGNORED"];

const PRIORITY_BADGE: Record<number, string> = {
  1: "badge-error",
  2: "badge-warning",
  3: "badge-muted",
  4: "badge-info",
  5: "badge-success",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const { t } = useI18n();

  async function load() {
    setLoading(true);
    const url = new URL("/api/tasks", window.location.origin);
    if (statusFilter) url.searchParams.set("status", statusFilter);
    const res = await fetch(url);
    const json = await res.json();
    setTasks(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeStatus(t: Task, newStatus: Task["status"]) {
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)));
    }
  }

  async function deleteTask(t: Task) {
    if (!confirm(`confirm_delete("${t.title}")?`)) return;
    const res = await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M14 — Task Queue</div>
          <h1 className="mt-2">Tasks</h1>
        </div>
        <div className="page-header-right">
          <button onClick={() => setShowNew(true)} className="btn-primary">
            + new_task
          </button>
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.tasks}</p>

      {/* 状态统计条 */}
      {!loading && tasks.length > 0 && (
        <div className="mb-8 grid grid-cols-5 gap-px bg-border">
          <button
            onClick={() => setStatusFilter("")}
            className={`cell text-left transition-colors hover:bg-card ${!statusFilter ? "border-b-2 border-primary" : ""}`}
          >
            <div className="eyebrow">all</div>
            <div className="metric-number-sm mt-1">{tasks.length}</div>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={`cell text-left transition-colors hover:bg-card ${statusFilter === s ? "border-b-2 border-primary" : ""}`}
            >
              <div className="eyebrow">{STATUS_LABEL[s]}</div>
              <div className="metric-number-sm mt-1">{counts[s]}</div>
            </button>
          ))}
        </div>
      )}

      {/* 任务表格 */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          [ no_tasks ] {statusFilter ? `— filter: ${statusFilter}` : ""}
        </div>
      ) : (
        <div className="border border-border">
          <table>
            <thead>
              <tr>
                <th>task</th>
                <th>project</th>
                <th className="w-16">priority</th>
                <th className="w-32">status</th>
                <th className="w-24">actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="group">
                  <td>
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="mono-line mt-0.5 text-[10px] line-clamp-1">
                        {t.description}
                      </div>
                    )}
                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mono-line mt-0.5 block text-[10px] text-info hover:text-primary"
                      >
                        {t.url}
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="text-sm">{t.project.name}</div>
                    <div className="mono-line text-[10px]">{t.project.domain}</div>
                  </td>
                  <td>
                    <span className={`badge ${PRIORITY_BADGE[t.priority] ?? "badge-muted"}`}>
                      P{t.priority}
                    </span>
                  </td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => void changeStatus(t, e.target.value as Task["status"])}
                      className="btn-ghost btn-sm w-full cursor-pointer"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => void deleteTask(t)} className="btn-icon text-[10px]" title="delete">
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

      {showNew && (
        <NewTaskDialog
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void load(); }}
        />
      )}
    </div>
  );
}

function NewTaskDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    projectId: "",
    title: "",
    description: "",
    url: "",
    priority: 3,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const body: Record<string, unknown> = { projectId: form.projectId, title: form.title, priority: form.priority };
    if (form.description) body.description = form.description;
    if (form.url) body.url = form.url;

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json?.error?.message ?? "create_failed"); return; }
    onCreated();
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-panel">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">// M14 — New Task</div>
              <h2 className="mt-1">Create Task</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="mono-line block mb-2">project_id *</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <input type="text" required value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                placeholder="clxxx..." autoFocus />
            </div>
          </div>
          <div>
            <label className="mono-line block mb-2">title *</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <input type="text" required value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Fix meta description..." />
            </div>
          </div>
          <div>
            <label className="mono-line block mb-2">description</label>
            <div className="input-field">
              <span className="input-field-icon">›</span>
              <textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className="flex-1 bg-transparent outline-none text-sm resize-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mono-line block mb-2">url</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="url" value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="mono-line block mb-2">priority (1-5)</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <select value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>P{p}</option>)}
                </select>
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
