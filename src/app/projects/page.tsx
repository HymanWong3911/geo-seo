"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
  domain: string;
  primaryBrand: string;
  status: "ACTIVE" | "ARCHIVED";
  geoDailyEnabled: boolean;
  geoChannels: string[];
  createdAt: string;
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const isAdmin = session?.user?.role === "ADMIN";
  const { t } = useI18n();

  async function load() {
    setLoading(true);
    const url = new URL("/api/projects", window.location.origin);
    if (showArchived) url.searchParams.set("archived", "true");
    const res = await fetch(url);
    const json = await res.json();
    setProjects(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived, session?.user?.id]);

  async function archive(id: string) {
    if (!confirm("archive this project?")) return;
    const res = await fetch(`/api/projects/${id}/archive`, { method: "POST" });
    if (res.ok) void load();
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 10 ? [...prev, id] : prev,
    );
  }

  async function batchArchive() {
    if (!confirm(`archive ${selected.length} projects?`)) return;
    const res = await fetch("/api/projects/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", ids: selected }),
    });
    if (res.ok) {
      setSelected([]);
      void load();
    }
  }

  async function batchExport(type: "keywords" | "tasks" | "brands") {
    if (selected.length === 0) {
      alert("select projects first");
      return;
    }
    window.location.href = `/api/projects/batch/export?ids=${selected.join(",")}&type=${type}`;
  }

  function goCompare() {
    if (compareIds.length < 2) {
      alert("select 2+ projects");
      return;
    }
    window.location.href = `/projects/compare?ids=${compareIds.join(",")}`;
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* 页头 */}
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="eyebrow">// M02 — Project List</div>
          <h1 className="mt-2 text-2xl tracking-tight">Projects</h1>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3 w-3"
            />
            <span>show archived</span>
          </label>
          {isAdmin && (
            <Link href="/projects/new" className="btn-primary">+ new</Link>
          )}
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.projects}</p>

      {/* 批量操作条 */}
      {(selected.length > 0 || compareIds.length > 0) && (
        <div className="mb-8 border border-foreground bg-foreground text-background">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em]">
              {selected.length > 0 && (
                <span className="border border-background/30 px-2 py-0.5">
                  selected · {selected.length}
                </span>
              )}
              {compareIds.length > 0 && (
                <span className="border border-background/30 px-2 py-0.5">
                  compare · {compareIds.length}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
              {selected.length > 0 && (
                <>
                  <button onClick={() => batchExport("keywords")} className="border border-background/30 px-2 py-1 hover:bg-background/10">
                    export kw
                  </button>
                  <button onClick={() => batchExport("tasks")} className="border border-background/30 px-2 py-1 hover:bg-background/10">
                    export task
                  </button>
                  <button onClick={() => batchExport("brands")} className="border border-background/30 px-2 py-1 hover:bg-background/10">
                    export brand
                  </button>
                  {isAdmin && (
                    <button onClick={batchArchive} className="border border-background/30 px-2 py-1 hover:bg-background/10">
                      archive
                    </button>
                  )}
                </>
              )}
              {compareIds.length >= 2 && (
                <button onClick={goCompare} className="border border-background px-2 py-1 bg-background text-foreground hover:bg-background/90">
                  compare →
                </button>
              )}
              <button
                onClick={() => { setSelected([]); setCompareIds([]); }}
                className="border border-background/30 px-2 py-1 hover:bg-background/10"
              >
                clear
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="border border-border p-12 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          <span className="status-dot idle" /> loading
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-border p-12 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          [ {showArchived ? "no archived" : "no active"} projects ]
        </div>
      ) : (
        <div className="border border-border">
          <table>
            <thead>
              <tr>
                <th className="w-16"></th>
                <th>//id</th>
                <th>name</th>
                <th>domain</th>
                <th>primary brand</th>
                <th className="w-28">channels</th>
                <th className="w-28">status</th>
                <th className="w-20">actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const isSelected = selected.includes(p.id);
                const isCompare = compareIds.includes(p.id);
                return (
                  <tr key={p.id} className={isSelected ? "bg-card" : ""}>
                    <td>
                      <div className="flex gap-1 font-mono text-[10px]">
                        <button
                          onClick={() => toggleSelect(p.id)}
                          className={`border px-1.5 transition-colors ${
                            isSelected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground"
                          }`}
                          title="batch"
                        >
                          ▤
                        </button>
                        <button
                          onClick={() => toggleCompare(p.id)}
                          className={`border px-1.5 transition-colors ${
                            isCompare
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-foreground"
                          }`}
                          title="compare"
                        >
                          ⇄
                        </button>
                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-muted-foreground">
                      {p.id.slice(-8)}
                    </td>
                    <td>
                      <Link href={`/projects/${p.id}`} className="text-foreground hover:text-primary">
                        {p.name}
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{p.domain}</td>
                    <td>{p.primaryBrand}</td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {p.geoChannels.length} ch
                    </td>
                    <td>
                      {p.status === "ARCHIVED" ? (
                        <span className="badge badge-muted">archived</span>
                      ) : p.geoDailyEnabled ? (
                        <span className="badge badge-success">daily on</span>
                      ) : (
                        <span className="badge badge-muted">paused</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2 font-mono text-[10px]">
                        <Link
                          href={`/projects/${p.id}/health`}
                          className="text-foreground hover:text-primary"
                        >
                          health
                        </Link>
                        <span className="text-muted-foreground/30">/</span>
                        <Link
                          href={`/projects/${p.id}/settings`}
                          className="text-foreground hover:text-primary"
                        >
                          set
                        </Link>
                        {p.status === "ACTIVE" && isAdmin && (
                          <>
                            <span className="text-muted-foreground/30">/</span>
                            <button
                              onClick={() => void archive(p.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              arch
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        // hint :: hover row → batch / compare actions
      </div>
    </div>
  );
}