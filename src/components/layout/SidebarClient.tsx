"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useI18n, type Dict } from "@/lib/i18n"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  labelKey: keyof Dict["nav"]["items"]
  code: string
  icon?: React.ReactNode
}

const SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "首页",
    items: [
      { href: "/dashboard", labelKey: "dashboard", code: "01" },
      { href: "/projects", labelKey: "projects", code: "02" },
    ],
  },
  {
    label: "SEO 诊断",
    items: [
      { href: "/audits", labelKey: "audits", code: "03" },
      { href: "/keywords", labelKey: "keywords", code: "04" },
    ],
  },
  {
    label: "GEO 监测",
    items: [
      { href: "/geo", labelKey: "geo", code: "05" },
      { href: "/geo/runs", labelKey: "geoRuns", code: "06" },
    ],
  },
  {
    label: "内容运营",
    items: [
      { href: "/content", labelKey: "content", code: "07" },
      { href: "/content/drafts", labelKey: "drafts", code: "08" },
      { href: "/content/review", labelKey: "review", code: "09" },
      { href: "/content/distribution", labelKey: "distribution", code: "10" },
    ],
  },
  {
    label: "任务与报告",
    items: [
      { href: "/tasks", labelKey: "tasks", code: "11" },
      { href: "/reports", labelKey: "reports", code: "12" },
      { href: "/brand/monitor", labelKey: "brandMonitor", code: "13" },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/notifications", labelKey: "notifications", code: "14" },
      { href: "/settings", labelKey: "settings", code: "15" },
    ],
  },
]

const ADMIN_SECTION: { label: string; items: NavItem[] } = {
  label: "管理",
  items: [
    { href: "/settings/users", labelKey: "users", code: "A1" },
    { href: "/settings/cms", labelKey: "cms", code: "A2" },
    { href: "/settings/audit-log", labelKey: "auditLog", code: "A3" },
    { href: "/settings/distribution", labelKey: "distributionConfig", code: "A4" },
    { href: "/settings/alerts", labelKey: "alertChannels", code: "A5" },
  ],
}

export function SidebarClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n()
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/"
    if (href === "/projects") return pathname.startsWith("/projects")
    if (href === "/audits") return pathname.startsWith("/audits")
    if (href === "/keywords") return pathname.startsWith("/keywords")
    if (href === "/geo/runs") return pathname === "/geo/runs"
    if (href === "/geo") return pathname === "/geo"
    if (href === "/content/drafts") return pathname === "/content/drafts"
    if (href === "/content/review") return pathname === "/content/review"
    if (href === "/content/distribution") return pathname.startsWith("/content/distribution")
    if (href === "/content") return pathname === "/content"
    if (href === "/tasks") return pathname.startsWith("/tasks")
    if (href === "/reports") return pathname.startsWith("/reports")
    if (href === "/brand/monitor") return pathname.startsWith("/brand/monitor")
    if (href === "/notifications") return pathname.startsWith("/notifications")
    if (href === "/settings/users") return pathname === "/settings/users"
    if (href === "/settings/cms") return pathname === "/settings/cms"
    if (href === "/settings/audit-log") return pathname === "/settings/audit-log"
    if (href === "/settings/distribution") return pathname === "/settings/distribution"
    if (href === "/settings/alerts") return pathname.startsWith("/settings/alerts")
    if (href === "/settings") return pathname === "/settings"
    return pathname.startsWith(href)
  }

  return (
    <aside className="relative flex w-60 shrink-0 flex-col border-r border-border/50 bg-gradient-to-b from-background to-background/50">
      {/* 顶部品牌 */}
      <div className="relative flex h-16 items-center gap-3 border-b border-border/50 px-5">
        {/* Logo */}
        <div className="relative h-8 w-8 shrink-0">
          <div className="absolute inset-0 rounded-lg border border-primary/30" />
          <div className="absolute inset-[3px] rounded-md bg-gradient-to-br from-primary/20 to-transparent" />
          <div className="absolute inset-[6px] rounded bg-primary/40" />
          {/* 发光效果 */}
          <div className="absolute -inset-1 rounded-lg bg-primary/20 blur-sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">{t.brand}</span>
          <span className="text-[10px] text-muted-foreground">Control Center</span>
        </div>
        
        {/* 右侧控制 */}
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <div className="relative">
            <span className="status-dot online" title="系统在线" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scroll-area">
        {SECTIONS.map((section, si) => (
          <div key={section.label} className="mb-2">
            {si > 0 && (
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            )}
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/70">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} label={t.nav.items[item.labelKey]} active={isActive(item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {isAdmin && (
          <div className="mb-2">
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/70">
              {ADMIN_SECTION.label}
            </div>
            <ul className="space-y-0.5">
              {ADMIN_SECTION.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} label={t.nav.items[item.labelKey]} active={isActive(item.href)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* 底部状态 */}
      <div className="border-t border-border/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              System Online
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/50">v1.0.0</span>
        </div>
      </div>
    </aside>
  )
}

function NavLink({ item, label, active }: { item: NavItem; label: string; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
        active
          ? "bg-gradient-to-r from-primary/15 to-transparent text-foreground font-medium shadow-sm"
          : "text-foreground/40 hover:bg-secondary hover:text-foreground hover:translate-x-0.5"
      )}
    >
      {/* 背景发光 */}
      {active && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-transparent opacity-50" />
      )}
      
      {/* 左侧指示条 */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary shadow-sm shadow-primary/50" />
      )}
      
      {/* 序号 */}
      <span
        className={cn(
          "relative w-6 shrink-0 text-right font-mono text-[10px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
        )}
      >
        {item.code}
      </span>
      
      {/* 标签 */}
      <span className="relative flex-1 truncate">{label}</span>
      
      {/* 箭头指示 */}
      <span
        className={cn(
          "relative text-xs transition-all duration-200",
          active ? "text-primary opacity-100 translate-x-0" : "text-muted-foreground/30 opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0"
        )}
      >
        ›
      </span>
    </Link>
  )
}
