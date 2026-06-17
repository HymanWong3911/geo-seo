import Link from "next/link"
import { auth } from "@/lib/auth"

type NavItem = {
  href: string
  labelKey: keyof import("@/lib/i18n").Dict["nav"]["items"]
  code: string
}

const NAV_PUBLIC: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", code: "01" },
  { href: "/projects", labelKey: "projects", code: "02" },
  { href: "/audits", labelKey: "audits", code: "03" },
  { href: "/keywords", labelKey: "keywords", code: "04" },
  { href: "/geo", labelKey: "geo", code: "05" },
  { href: "/geo/runs", labelKey: "geoRuns", code: "06" },
  { href: "/content", labelKey: "content", code: "07" },
  { href: "/content/drafts", labelKey: "drafts", code: "08" },
  { href: "/content/review", labelKey: "review", code: "09" },
  { href: "/content/distribution", labelKey: "distribution", code: "10" },
  { href: "/tasks", labelKey: "tasks", code: "11" },
  { href: "/reports", labelKey: "reports", code: "12" },
  { href: "/brand/monitor", labelKey: "brandMonitor", code: "13" },
  { href: "/notifications", labelKey: "notifications", code: "14" },
  { href: "/settings", labelKey: "settings", code: "15" },
]

const NAV_ADMIN: NavItem[] = [
  { href: "/settings/users", labelKey: "users", code: "A1" },
  { href: "/settings/cms", labelKey: "cms", code: "A2" },
  { href: "/settings/channels", labelKey: "channels", code: "A2" },
  { href: "/settings/audit-log", labelKey: "auditLog", code: "A3" },
  { href: "/settings/distribution", labelKey: "distributionConfig", code: "A4" },
  { href: "/settings/alerts", labelKey: "alertChannels", code: "A5" },
]

import { SidebarClient } from "./SidebarClient"

export async function Sidebar() {
  const session = await auth()
  const isAdmin = session?.user?.role === "ADMIN"

  return <SidebarClient isAdmin={isAdmin} />
}
