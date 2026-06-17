"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

// 仪表板区块
interface DashboardSectionProps {
  title?: string
  eyebrow?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function DashboardSection({
  title,
  eyebrow,
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
