"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";

interface Project {
  id: string;
  name: string;
  domain: string;
  status: "ACTIVE" | "ARCHIVED";
}

const STORAGE_KEY = "geo-seo:selectedProjectId";

export function Topbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useI18n();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects(json.data ?? []);

      const urlId = searchParams.get("projectId");
      const storedId =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const firstId = (json.data ?? [])[0]?.id ?? "";
      const selected = urlId || storedId || firstId;
      if (selected) setCurrentId(selected);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      const ss = d.getSeconds().toString().padStart(2, "0");
      setNow(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function onChange(id: string) {
    setCurrentId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("projectId", id);
    else url.searchParams.delete("projectId");
    router.replace(url.pathname + url.search);
    router.refresh();
  }

  const current = projects.find((p) => p.id === currentId);
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur-xl">
      {/* 左：面包屑 */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {t.topbar.pathLabel}
        </span>
        {segments.length === 0 ? (
          <span className="text-foreground">root</span>
        ) : (
          segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className={
                  i === segments.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {seg}
              </span>
              {i < segments.length - 1 && (
                <span className="text-muted-foreground/40">/</span>
              )}
            </span>
          ))
        )}
      </div>

      {/* 中：项目选择器 */}
      <div className="flex items-center gap-3">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground md:inline">
          ▸
        </span>
        {loading ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="status-dot idle" /> {t.common.loading}
          </span>
        ) : projects.length === 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            no_projects
          </span>
        ) : (
          <select
            value={currentId}
            onChange={(e) => onChange(e.target.value)}
            className="border border-border bg-card px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-foreground outline-none transition-colors hover:border-foreground focus:border-primary"
          >
            <option value="">{t.topbar.noneProject}</option>
            {projects
              .filter((p) => p.status === "ACTIVE")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        )}
        {current?.status === "ARCHIVED" && (
          <span className="badge badge-warning">arch</span>
        )}
      </div>

      {/* 右：用户 + 时钟 */}
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <div className="hidden items-center gap-2 md:flex">
          <span className="status-dot online" />
          <span className="text-foreground">
            {session?.user?.email?.split("@")[0] ?? "guest"}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-foreground">{now}</span>
        </div>
      </div>
    </header>
  );
}
