"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

// 仪表板区块
interface DashboardSectionProps {
  title?: string
  eyebrow?: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function DashboardSection({
  title,
  eyebrow,
  description,
  children,
  actions,
  className = "",
}: DashboardSectionProps) {
  return (
    <section className={cn("relative", className)}>
      {(title || eyebrow || actions) && (
        <div className="flex items-end justify-between mb-6 pb-4 border-b border-border/50">
          <div>
            {eyebrow && (
              <div className="eyebrow mb-2 text-primary/70">{eyebrow}</div>
            )}
            {title && (
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// 迷你趋势图
interface MiniChartProps {
  data: number[]
  color?: "primary" | "success" | "warning" | "info"
  height?: number
  showArea?: boolean
  className?: string
}

export function MiniChart({
  data,
  color = "primary",
  height = 48,
  showArea = true,
  className = "",
}: MiniChartProps) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1

  const colorMap = {
    primary: "var(--primary)",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    info: "hsl(var(--info))",
  }

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 80 - 10
    return `${x},${y}`
  }).join(" ")

  const fillPoints = `0,100 ${points} 100,100`

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorMap[color]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorMap[color]} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && (
        <polygon points={fillPoints} fill={`url(#gradient-${color})`} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-size"
        className="transition-all duration-500"
      />
      {/* 最后一个点 */}
      {data.length > 0 && (
        <circle
          cx="100"
          cy={100 - ((data[data.length - 1] - min) / range) * 80 - 10}
          r="3"
          fill={colorMap[color]}
          className="transition-all duration-500"
        >
          <animate
            attributeName="r"
            values="2;4;2"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  )
}

// 环形评分
interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  className?: string
}

export function ScoreRing({
  score,
  size = 64,
  strokeWidth = 4,
  showLabel = true,
  className = "",
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference

  const getScoreColor = (s: number) => {
    if (s >= 80) return "var(--success)"
    if (s >= 60) return "var(--warning)"
    return "var(--destructive)"
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* 进度环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: getScoreColor(score) }}
          >
            {score}
          </span>
        </div>
      )}
    </div>
  )
}

// 进度条
interface ProgressBarProps {
  value: number
  max?: number
  color?: "primary" | "success" | "warning" | "error" | "info"
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  label?: string
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = "primary",
  size = "md",
  showLabel = false,
  label,
  className = "",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizeStyles = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  }

  const colorMap = {
    primary: "from-primary to-primary/70",
    success: "from-success to-success/70",
    warning: "from-warning to-warning/70",
    error: "from-destructive to-destructive/70",
    info: "from-info to-info/70",
  }

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", sizeStyles[size])}>
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out",
            colorMap[color]
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* 流光效果 */}
          <div className="relative h-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  )
}

// 状态指示器
interface StatusIndicatorProps {
  status: "online" | "offline" | "warning" | "error"
  label?: string
  pulse?: boolean
  className?: string
}

export function StatusIndicator({
  status,
  label,
  pulse = false,
  className = "",
}: StatusIndicatorProps) {
  const statusStyles = {
    online: "bg-success",
    offline: "bg-muted-foreground",
    warning: "bg-warning",
    error: "bg-destructive",
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("relative flex h-2 w-2")}>
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              statusStyles[status]
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            statusStyles[status]
          )}
        />
      </span>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

// 列表项
interface ListItemProps {
  title: string
  description?: string
  leftIcon?: ReactNode
  rightContent?: ReactNode
  badge?: string
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  href?: string
  onClick?: () => void
  className?: string
}

export function ListItem({
  title,
  description,
  leftIcon,
  rightContent,
  badge,
  badgeVariant = "default",
  href,
  onClick,
  className = "",
}: ListItemProps) {
  const content = (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-border/50 p-4",
        "transition-all duration-200 hover:border-primary/30 hover:bg-card/50",
        href && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {leftIcon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-lg">
          {leftIcon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground truncate">{description}</div>
        )}
      </div>
      {badge && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            badgeVariant === "success" && "bg-success/15 text-success",
            badgeVariant === "warning" && "bg-warning/15 text-warning",
            badgeVariant === "error" && "bg-destructive/15 text-destructive",
            badgeVariant === "info" && "bg-info/15 text-info",
            badgeVariant === "default" && "bg-muted text-muted-foreground"
          )}
        >
          {badge}
        </span>
      )}
      {rightContent && <div>{rightContent}</div>}
    </div>
  )

  if (href) {
    return <a href={href}>{content}</a>
  }

  return content
}

// ============================================================
// Donut 圆环图 (多段饼图,常用于来源/平台分布)
// ============================================================
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  className?: string;
}

export function DonutChart({
  segments,
  size = 120,
  thickness = 14,
  centerLabel,
  centerValue,
  showLegend = true,
  className = "",
}: DonutChartProps) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
          {total > 0 && segments.map((seg, i) => {
            const portion = seg.value / total;
            const dash = portion * c;
            const offset = c - acc * c;
            acc += portion;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                className="transition-all duration-700"
              />
            );
          })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-lg font-bold tabular-nums">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex-1 space-y-1.5 min-w-0">
          {segments.map((seg, i) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="flex-1 truncate text-muted-foreground">{seg.label}</span>
                <span className="font-mono tabular-nums">{seg.value}</span>
                <span className="text-muted-foreground font-mono tabular-nums w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BarChart 横向条形图(常用于 Top N)
// ============================================================
export interface BarItem {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}

interface BarChartProps {
  data: BarItem[];
  max?: number;
  showValues?: boolean;
  className?: string;
  defaultColor?: string;
}

export function BarChart({
  data,
  max,
  showValues = true,
  className = "",
  defaultColor = "hsl(var(--primary))",
}: BarChartProps) {
  const m = max ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div className={`space-y-2 ${className}`}>
      {data.map((item, i) => {
        const pct = Math.min(100, Math.max(0, (item.value / m) * 100));
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-foreground/90">{item.label}</span>
              {showValues && (
                <span className="font-mono tabular-nums text-muted-foreground">
                  {item.value}{item.suffix ?? ""}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color ?? defaultColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Sparkline 极简趋势线(更细更窄,适合塞进 stat card)
// ============================================================
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  width = 80,
  height = 24,
  className = "",
}: SparklineProps) {
  if (data.length < 2) {
    return <div className={`font-mono text-[10px] text-muted-foreground ${className}`} style={{ width, height }}>_</div>;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2" fill={color} />
    </svg>
  );
}

// ============================================================
// EmptyState 通用空态
// ============================================================
interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "∅",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border/60 rounded-lg bg-card/20 ${className}`}>
      <div className="text-3xl mb-3 opacity-50">{icon}</div>
      {title && <div className="text-sm font-medium text-foreground mb-1">{title}</div>}
      {description && <div className="text-xs text-muted-foreground max-w-md">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
