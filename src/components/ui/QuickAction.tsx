"use client"

import Link from "next/link"
import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface QuickActionProps {
  title: string
  description?: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
  badge?: string
  badgeVariant?: "default" | "success" | "warning" | "error" | "info"
  className?: string
}

const badgeStyles = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success border border-success/20",
  warning: "bg-warning/10 text-warning border border-warning/20",
  error: "bg-destructive/10 text-destructive border border-destructive/20",
  info: "bg-info/10 text-info border border-info/20",
}

export function QuickAction({
  title,
  description,
  icon,
  href,
  onClick,
  badge,
  badgeVariant = "default",
  className = "",
}: QuickActionProps) {
  const content = (
    <div
      className={cn(
        `group relative flex items-start gap-4 rounded-lg border border-border/50 bg-card p-4 
        transition-all duration-300 ease-elegant cursor-pointer`,
        "hover:border-primary/30 hover:bg-gradient-to-br hover:from-card hover:to-primary/5",
        "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {/* 背景渐变 */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      {/* 左侧指示线 */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary/0 transition-all duration-300 group-hover:bg-primary/50 group-hover:h-12" />

      {/* 图标 */}
      {icon && (
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-lg transition-transform duration-300 group-hover:scale-110 group-hover:from-primary/20">
          {icon}
        </div>
      )}

      {/* 内容 */}
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium group-hover:text-primary transition-colors duration-200">
            {title}
          </h3>
          {badge && (
            <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded", badgeStyles[badgeVariant])}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* 箭头 */}
      <div className="relative flex items-center text-muted-foreground/30 transition-all duration-300 group-hover:text-primary group-hover:translate-x-1">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

interface QuickActionGridProps {
  children: ReactNode
  cols?: 1 | 2
  className?: string
}

export function QuickActionGrid({ children, cols = 2, className = "" }: QuickActionGridProps) {
  return (
    <div className={cn(
      "grid gap-3",
      cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
      className
    )}>
      {children}
    </div>
  )
}
