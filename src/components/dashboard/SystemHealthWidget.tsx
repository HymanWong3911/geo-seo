"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HealthData {
  status: "ok" | "degraded";
  checks: {
    database: { ok: boolean; latencyMs: number };
    redis: { ok: boolean; latencyMs: number };
    counts?: { ok: boolean; latencyMs: number };
    lastRun?: { ok: boolean; latencyMs: number };
  };
  data: {
    projectCount: number;
    geoRunCount: number;
    geoRunResultCount: number;
    brandMentionCount: number;
    llmCallCount: number;
    contentDraftCount: number;
    lastGeoRun?: {
      id: string;
      status: string;
      finishedAt: string;
    };
  };
  timestamp: string;
}

export function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setHealth(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchHealth();
    const id = setInterval(fetchHealth, 15_000);
    const ageId = setInterval(() => setAge(a => a + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(ageId);
    };
  }, []);

  if (loading) {
    return (
      <div className="border border-border bg-card/50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">checking system...</span>
        </div>
      </div>
    );
  }

  const ok = health?.status === "ok";
  const db = health?.checks.database;
  const redis = health?.checks.redis;
  const lastRun = health?.data.lastGeoRun;

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all",
      ok ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            "h-2 w-2 rounded-full",
            ok ? "bg-success animate-pulse" : "bg-warning"
          )} />
          <span className="text-xs font-mono font-semibold tracking-wider uppercase">
            {ok ? "system_online" : "system_degraded"}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {age}s ago
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", db?.ok ? "bg-success" : "bg-destructive")} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">db</span>
          </div>
          <span className="text-sm font-mono tabular-nums">{db?.latencyMs ?? 0}<span className="text-muted-foreground text-[10px] ml-1">ms</span></span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", redis?.ok ? "bg-success" : "bg-destructive")} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">redis</span>
          </div>
          <span className="text-sm font-mono tabular-nums">{redis?.latencyMs ?? 0}<span className="text-muted-foreground text-[10px] ml-1">ms</span></span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">projects</span>
          <span className="text-sm font-mono tabular-nums">{health?.data.projectCount ?? 0}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">llm_calls</span>
          <span className="text-sm font-mono tabular-nums">{health?.data.llmCallCount ?? 0}</span>
        </div>
      </div>

      {lastRun && (
        <div className="mt-3 pt-3 border-t border-border/50 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
          <span>last_run · {lastRun.status}</span>
          <span className="tabular-nums">
            {lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleString() : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
