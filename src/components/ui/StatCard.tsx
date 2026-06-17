"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "success" | "warning" | "error" | "info"
type TrendDirection = "up" | "down" | "stable"

interface StatCardProps {
  label: string
  value: string | number
  suffix?: string
  trend?: TrendDirection
  trendValue?: string
  icon?: ReactNode
  progress?: number
  className?: string
  badge?: string
  badgeVariant?: BadgeVariant
  description?: string
  sparklineData?: number[]
  onClick?: () => void
}

const badgeStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success border border-success/20",
  warning: "bg-warning/10 text-warning border border-warning/20",
  error: "bg-destructive/10 text-destructive border border-destructive/20",
  info: "bg-info/10 text-info border border-info/20",
}

const trendStyles: Record<TrendDirection, { container: string; icon: string }> = {
  up: {
    container: "text-success",
    icon: "↑",
  },
  down: {
    container: "text-destructive",
    icon: "↓",
  },
  stable: {
    container: "text-muted-foreground",
    icon: "→",
  },
}

export function StatCard({
  label,
  value,
  suffix,
  trend,
  trendValue,
  icon,
  progress,
  className = "",
  badge,
  badgeVariant = "default",
  description,
  sparklineData,
  onClick,
}: StatCardProps) {
  const displayValue = typeof value === "number" 
    ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",") 
    : value

  return (
    <div
      onClick={onClick}
      className={cn(
        `relative overflow-hidden rounded-md border border-border bg-card p-6 transition-all duration-300
        before:absolute before:top-0 before:left-0 before:right-0 before:h-px
        before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent
        hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5
        active:scale-[0.99]`,
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* 背景装饰 */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
      
      <div className="relative">
        {/* 头部 */}
        <div className="flex items-start justify-between mb-4">
          <span className="eyebrow text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={cn("px-2 py-0.5 text-xs font-medium rounded", badgeStyles[badgeVariant])}>
                {badge}
              </span>
            )}
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                {icon}
              </span>
            )}
          </div>
        </div>

        {/* 数值 */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            {displayValue}
          </span>
          {suffix && (
            <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
          )}
        </div>

        {/* 描述 */}
        {description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
            {description}
          </p>
        )}

        {/* 趋势指示器 */}
        {trend && (
          <div className={cn("flex items-center gap-1.5 mt-3 text-sm font-medium", trendStyles[trend].container)}>
            <span className="text-base">{trendStyles[trend].icon}</span>
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}

        {/* 进度条 */}
        {progress !== undefined && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* 迷你趋势线 */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 h-8">
            <Sparkline data={sparklineData} />
          </div>
        )}
      </div>
    </div>
  )
}

function Sparkline({ data, color = "var(--primary)" }: { data: number[]; color?: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 80 - 10
    return `${x},${y}`
  }).join(" ")

  const fillPoints = `0,100 ${points} 100,100`

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#sparkline-gradient)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-size"
      />
    </svg>
  )
}

interface StatGridProps {
  children: ReactNode
  cols?: 2 | 3 | 4 | 5
  className?: string
}

export function StatGrid({ children, cols = 4, className = "" }: StatGridProps) {
  const colsClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }[cols]

  return (
    <div className={cn(`grid ${colsClass} gap-4`, className)}>
      {children}
    </div>
  )
}
