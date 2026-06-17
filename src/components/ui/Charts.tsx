"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const goldColor = "hsl(33, 38%, 60%)";
const goldColorHex = "#C5A572";

/* ============================================================
   GEO 评分趋势折线图
   ============================================================ */
interface GeoTrendPoint { date: string; score: number; }

export function GeoScoreChart({ data }: { data: GeoTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full mono-line text-xs text-muted-foreground">
        no_trend_data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(33, 12%, 18%)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(33, 12%, 18%)" }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(0, 0%, 8%)",
            border: "1px solid hsl(33, 25%, 28%)",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "hsl(36, 25%, 94%)",
          }}
          labelStyle={{ color: "hsl(33, 38%, 60%)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          formatter={(value: number) => [`${value}/100`, "GEO Score"]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={goldColorHex}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: goldColorHex, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   LLM 成本面积图
   ============================================================ */
interface CostTrendPoint { date: string; cost: number; }

export function LlmCostChart({ data }: { data: CostTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full mono-line text-xs text-muted-foreground">
        no_cost_data
      </div>
    );
  }

  const maxCost = Math.max(...data.map(d => d.cost), 0.01);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={goldColorHex} stopOpacity={0.3} />
            <stop offset="95%" stopColor={goldColorHex} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(33, 12%, 18%)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(33, 12%, 18%)" }}
        />
        <YAxis
          domain={[0, maxCost * 1.2]}
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `¥${v.toFixed(1)}`}
          tickCount={4}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(0, 0%, 8%)",
            border: "1px solid hsl(33, 25%, 28%)",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "hsl(36, 25%, 94%)",
          }}
          labelStyle={{ color: "hsl(33, 38%, 60%)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          formatter={(value: number) => [`¥${value.toFixed(4)}`, "LLM Cost"]}
        />
        <Area
          type="monotone"
          dataKey="cost"
          stroke={goldColorHex}
          strokeWidth={2}
          fill="url(#costGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   SEO 评分分布柱状图（用于审计页）
   ============================================================ */
interface ScoreDistPoint { range: string; count: number; }

export function ScoreDistChart({ data }: { data: ScoreDistPoint[] }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="distGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(0, 65%, 50%)" stopOpacity={0.8} />
            <stop offset="50%" stopColor="hsl(36, 60%, 55%)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="hsl(142, 45%, 50%)" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(33, 12%, 18%)" vertical={false} />
        <XAxis
          dataKey="range"
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(33, 12%, 18%)" }}
        />
        <YAxis
          tick={{ fill: "hsl(36, 8%, 65%)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickCount={4}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(0, 0%, 8%)",
            border: "1px solid hsl(33, 25%, 28%)",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "hsl(36, 25%, 94%)",
          }}
          labelStyle={{ color: "hsl(33, 38%, 60%)" }}
          formatter={(value: number) => [value, "pages"]}
        />
        <Area type="step" dataKey="count" stroke="url(#distGradient)" strokeWidth={2} fill="url(#distGradient)" fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
