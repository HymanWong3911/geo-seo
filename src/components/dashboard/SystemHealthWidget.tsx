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
    channels?: { ok: boolean; latencyMs: number; availableChannels: string[] };
    queues?: { ok: boolean; latencyMs: number };
  };
  data: {
    projectCount: number;
    geoRunCount: number;
    geoRunResultCount: number;
    brandMentionCount: number;
    llmCallCount: number;
    contentDraftCount: number;
    availableChannels: string[];
    lastGeoRun?: { id: string; status: string; finishedAt: string };
    llmStats24h?: {
      calls24h: number;
      tokens24h: { prompt: number; completion: number; total: number };
      costCents24h: number | string;
      byProvider: Record<string, { calls: number; tokens: number; costCents: number | string }>;
    };
    queueStats?: Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }>;
  };
  timestamp: string;
}

interface QueueStats {
  total: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  backlog: Array<{ queue: string; waiting: number; delayed: number }>;
  failureHotspots: Array<{ queue: string; failed: number }>;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cents: number | string): string {
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  return `¥${(n / 100).toFixed(2)}`;
}

const CHANNEL_DISPLAY: Record<string, { icon: string; label: string }> = {
  perplexity: { icon: "🔮", label: "Perplexity" },
  kimi: { icon: "🌙", label: "Kimi" },
  doubao: { icon: "🫘", label: "豆包" },
  llm_simulation: { icon: "🤖", label: "LLM 模拟" },
};

export function SystemHealthWidget() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [queues, setQueues] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [hRes, qRes] = await Promise.all([
          fetch("/api/health", { cache: "no-store" }),
          fetch("/api/queues/stats", { cache: "no-store" }),
        ]);
        if (hRes.ok) {
          const hJson = await hRes.json();
          if (!cancelled) {
            setHealth(hJson);
            setLoading(false);
          }
        }
        if (qRes.ok) {
          const qJson = await qRes.json();
          if (!cancelled) setQueues(qJson.data);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchAll();
    const id = setInterval(fetchAll, 15_000);
    const ageId = setInterval(() => setAge((a) => a + 1), 1000);
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
  const channels = health?.data.availableChannels ?? [];
  const llm = health?.data.llmStats24h;
  const qTotal = queues?.total ?? { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all space-y-3",
      ok ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
    )}>
      {/* 头部：状态 + 时间戳 */}
      <div className="flex items-center justify-between">
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

      {/* 主指标行：DB + Redis + LLM 24h + Queue */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", db?.ok ? "bg-success" : "bg-destructive")} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">db</span>
          </div>
          <span className="text-sm font-mono tabular-nums">
            {db?.latencyMs ?? 0}<span className="text-muted-foreground text-[10px] ml-1">ms</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", redis?.ok ? "bg-success" : "bg-destructive")} />
            <span className="text-[10px] font-mono text-muted-foreground uppercase">redis</span>
          </div>
          <span className="text-sm font-mono tabular-nums">
            {redis?.latencyMs ?? 0}<span className="text-muted-foreground text-[10px] ml-1">ms</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">llm_24h</span>
          <span className="text-sm font-mono tabular-nums">
            {llm ? `${llm.calls24h}c · ${formatNumber(llm.tokens24h.total)}t` : "—"}
          </span>
          {llm && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {formatCost(llm.costCents24h)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">queues</span>
          <span className="text-sm font-mono tabular-nums">
            {qTotal.active > 0 ? (
              <span className="text-info">{qTotal.active} active</span>
            ) : (
              <span className="text-muted-foreground">idle</span>
            )}
            {qTotal.failed > 0 && (
              <span className="text-destructive ml-2">{qTotal.failed} failed</span>
            )}
          </span>
          {qTotal.waiting + qTotal.delayed > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {qTotal.waiting + qTotal.delayed} backlog
            </span>
          )}
        </div>
      </div>

      {/* 渠道行 */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">channels</span>
        {["perplexity", "kimi", "doubao", "llm_simulation"].map((c) => {
          const active = channels.includes(c);
          return (
            <span
              key={c}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors",
                active
                  ? "bg-success/10 text-success border border-success/30"
                  : "bg-muted/30 text-muted-foreground border border-border/50"
              )}
              title={active ? "可用" : "未配置"}
            >
              <span className="text-xs">{CHANNEL_DISPLAY[c]?.icon ?? "•"}</span>
              <span>{CHANNEL_DISPLAY[c]?.label ?? c}</span>
              <span className={cn("h-1.5 w-1.5 rounded-full ml-1", active ? "bg-success animate-pulse" : "bg-muted-foreground/40")} />
            </span>
          );
        })}
      </div>

      {/* 最近一次 GEO run */}
      {lastRun && (
        <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between pt-2 border-t border-border/30">
          <span>last_run · <span className={cn(
            lastRun.status === "SUCCESS" ? "text-success" :
            lastRun.status === "RUNNING" ? "text-info animate-pulse" :
            lastRun.status === "FAILED" ? "text-destructive" : "text-warning"
          )}>{lastRun.status}</span></span>
          <span className="tabular-nums">
            {lastRun.finishedAt ? new Date(lastRun.finishedAt).toLocaleString() : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
