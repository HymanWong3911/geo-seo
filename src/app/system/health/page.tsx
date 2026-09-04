"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSection } from "@/components/ui/DashboardWidgets";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface QueueData {
  queues: Record<string, QueueStats>;
  total: QueueStats;
  backlog: Array<{ queue: string; waiting: number; delayed: number }>;
  failureHotspots: Array<{ queue: string; failed: number }>;
  errors: string[] | null;
  timestamp: string;
}

interface HealthData {
  status: "ok" | "degraded";
  checks: {
    database: { ok: boolean; latencyMs: number };
    redis: { ok: boolean; latencyMs: number };
    availableChannels: string[];
  };
  data: {
    projectCount: number;
    geoRunCount: number;
    geoRunResultCount: number;
    brandMentionCount: number;
    llmCallCount: number;
    contentDraftCount: number;
    lastGeoRun?: { id: string; status: string; finishedAt: string; createdAt: string };
    llmStats24h?: {
      calls24h: number;
      tokens24h: { total: number };
      costCents24h: number | string;
      byProvider: Record<string, { calls: number; tokens: number; costCents: number | string }>;
    };
  };
}

const QUEUE_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  "geo-run": { icon: "🤖", label: "GEO 运行", desc: "AI 搜索可见度监测" },
  "page-audit": { icon: "🔍", label: "页面诊断", desc: "SEO 评分 + 抓取错误" },
  "content-analysis": { icon: "📊", label: "内容分析", desc: "关键词覆盖 + 质量评分" },
  "report": { icon: "📑", label: "报告生成", desc: "PDF / 周报 / 月报" },
  "scheduler": { icon: "⏰", label: "调度器", desc: "每日 GEO 监测 + 告警汇总" },
  "retention": { icon: "🗑️", label: "数据归档", desc: "过期数据清理" },
  "cms-publish": { icon: "📤", label: "CMS 发布", desc: "草稿 → WordPress/其他" },
  "distribution": { icon: "🔀", label: "分发", desc: "知乎/微信/百家号 等" },
  "alert-sender": { icon: "🔔", label: "告警发送", desc: "邮件/钉钉/企业微信" },
};

const CHANNEL_LABELS: Record<string, { icon: string; label: string }> = {
  perplexity: { icon: "🔮", label: "Perplexity" },
  kimi: { icon: "🌙", label: "Kimi" },
  doubao: { icon: "🫘", label: "豆包" },
  llm_simulation: { icon: "🤖", label: "LLM 模拟" },
};

export default function SystemHealthPage() {
  const [queues, setQueues] = useState<QueueData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [age, setAge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [q, h] = await Promise.all([
          fetch("/api/queues/stats", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" }),
        ]);
        if (!cancelled) {
          if (q.ok) setQueues((await q.json()).data);
          if (h.ok) setHealth(await h.json());
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, 10_000);
    const ageId = setInterval(() => setAge((a) => a + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(ageId);
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="// 系统健康"
        title="系统健康"
        description="实时 worker 队列、LLM 渠道、数据状态"
      >
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <span className={cn(
            "h-2 w-2 rounded-full",
            health?.status === "ok" ? "bg-success animate-pulse" : "bg-warning"
          )} />
          <span>{health?.status === "ok" ? "online" : "degraded"}</span>
          <span className="tabular-nums">· {age}s ago</span>
        </div>
      </PageHeader>

      {loading || !queues || !health ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          {/* 顶部统计 */}
          <StatGrid cols={4}>
            <StatCard
              label="活跃任务"
              value={queues.total.active}
              badge={queues.total.active > 0 ? "running" : "idle"}
              badgeVariant={queues.total.active > 0 ? "info" : "default"}
            />
            <StatCard
              label="队列积压"
              value={queues.total.waiting + queues.total.delayed}
              suffix="等待"
              trend={queues.total.waiting + queues.total.delayed > 0 ? "down" : "up"}
              trendValue={queues.total.waiting + queues.total.delayed > 0 ? "check" : "ok"}
            />
            <StatCard
              label="失败任务"
              value={queues.total.failed}
              badgeVariant={queues.total.failed > 0 ? "error" : "default"}
              badge={queues.total.failed > 0 ? "需关注" : "ok"}
            />
            <StatCard
              label="已完成"
              value={queues.total.completed}
              suffix="(本周期)"
            />
          </StatGrid>

          {/* LLM 渠道 */}
          <DashboardSection eyebrow="// LLM 渠道">
            <div className="border border-border bg-card rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.keys(CHANNEL_LABELS).map((c) => {
                  const available = health.data.availableChannels.includes(c);
                  return (
                    <div
                      key={c}
                      className={cn(
                        "border rounded-lg p-3 transition-colors",
                        available
                          ? "border-success/30 bg-success/5"
                          : "border-border bg-muted/10"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base">{CHANNEL_LABELS[c].icon}</span>
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          available ? "bg-success animate-pulse" : "bg-muted-foreground/40"
                        )} />
                      </div>
                      <div className="text-xs font-mono font-semibold">
                        {CHANNEL_LABELS[c].label}
                      </div>
                      <div className={cn(
                        "text-[10px] font-mono mt-1",
                        available ? "text-success" : "text-muted-foreground"
                      )}>
                        {available ? "✓ 可用" : "○ 未配置"}
                      </div>
                    </div>
                  );
                })}
              </div>
              {health.data.llmStats24h && (
                <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">24h LLM 用量</span>
                  <span className="tabular-nums">
                    {health.data.llmStats24h.calls24h} calls · {formatNumber(health.data.llmStats24h.tokens24h.total)} tokens · {formatCost(health.data.llmStats24h.costCents24h)}
                  </span>
                </div>
              )}
            </div>
          </DashboardSection>

          {/* 队列详情 */}
          <DashboardSection eyebrow="// 工作队列">
            <div className="border border-border bg-card rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] font-mono uppercase text-muted-foreground">
                    <th className="text-left p-3">队列</th>
                    <th className="text-right p-3">等待</th>
                    <th className="text-right p-3">活跃</th>
                    <th className="text-right p-3">完成</th>
                    <th className="text-right p-3">失败</th>
                    <th className="text-right p-3">延迟</th>
                    <th className="text-left p-3">健康</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(queues.queues).map(([name, s]) => {
                    const cfg = QUEUE_LABELS[name];
                    const isError = s.failed > 5;
                    const hasBacklog = s.waiting + s.delayed > 3;
                    return (
                      <tr key={name} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cfg?.icon ?? "•"}</span>
                            <div>
                              <div className="font-mono text-xs font-semibold">{cfg?.label ?? name}</div>
                              <div className="text-[10px] text-muted-foreground">{cfg?.desc ?? ""}</div>
                            </div>
                          </div>
                        </td>
                        <td className={cn("p-3 text-right tabular-nums", s.waiting > 0 ? "text-warning font-semibold" : "text-muted-foreground")}>{s.waiting}</td>
                        <td className={cn("p-3 text-right tabular-nums", s.active > 0 ? "text-info font-semibold animate-pulse" : "text-muted-foreground")}>{s.active}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">{s.completed}</td>
                        <td className={cn("p-3 text-right tabular-nums", s.failed > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>{s.failed}</td>
                        <td className={cn("p-3 text-right tabular-nums", s.delayed > 0 ? "text-muted-foreground" : "text-muted-foreground/50")}>{s.delayed}</td>
                        <td className="p-3">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-destructive">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> 异常
                            </span>
                          ) : hasBacklog ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-warning">
                              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" /> 积压
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-success">
                              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> 健康
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardSection>

          {/* 关键指标 + 最近 GEO run */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border bg-card rounded-lg p-4">
              <div className="eyebrow mb-3">数据统计</div>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="flex justify-between"><span className="text-muted-foreground">项目</span><span className="tabular-nums">{health.data.projectCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GEO runs</span><span className="tabular-nums">{health.data.geoRunCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">结果</span><span className="tabular-nums">{health.data.geoRunResultCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">提及</span><span className="tabular-nums">{health.data.brandMentionCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">LLM calls</span><span className="tabular-nums">{health.data.llmCallCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">草稿</span><span className="tabular-nums">{health.data.contentDraftCount}</span></div>
              </div>
            </div>
            <div className="border border-border bg-card rounded-lg p-4">
              <div className="eyebrow mb-3">最近 GEO Run</div>
              {health.data.lastGeoRun ? (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">状态</span>
                    <span className={cn(
                      health.data.lastGeoRun.status === "SUCCESS" ? "text-success" :
                      health.data.lastGeoRun.status === "RUNNING" ? "text-info animate-pulse" :
                      "text-destructive"
                    )}>{health.data.lastGeoRun.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">开始</span>
                    <span className="tabular-nums">{new Date(health.data.lastGeoRun.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">完成</span>
                    <span className="tabular-nums">{health.data.lastGeoRun.finishedAt ? new Date(health.data.lastGeoRun.finishedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</span>
                  </div>
                  <div className="pt-2 border-t border-border/30">
                    <Link href={`/geo/runs/${health.data.lastGeoRun.id}`} className="text-primary hover:underline text-[10px]">
                      查看详情 →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">暂无 GEO run</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cents: number | string): string {
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  return `¥${(n / 100).toFixed(2)}`;
}
