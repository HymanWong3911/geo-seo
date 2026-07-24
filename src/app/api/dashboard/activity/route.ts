// 投资人 demo 用:Dashboard 顶部 "近期活动" feed。
// 综合 3 类事件:GEO run 完成 / LLM 关键调用 / AuditLog 关键操作。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(15),
  projectId: z.string().optional(),
});

interface ActivityItem {
  id: string;
  ts: string;
  kind: "geo_run" | "audit" | "llm_call";
  icon: string;
  title: string;
  detail: string;
  href?: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
    });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const limit = parsed.data.limit;
    const projectFilter = parsed.data.projectId;

    const items: ActivityItem[] = [];

    // 1) 最近 GEO run 完成
    const geoRuns = await prisma.geoRun.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: "desc" },
      take: limit,
      select: {
        id: true, status: true, finishedAt: true, totalQuestions: true, answeredQuestions: true,
        projectId: true, _count: { select: { results: true } },
        project: { select: { name: true } },
      },
    });
    for (const r of geoRuns) {
      if (!r.finishedAt) continue;
      const icon = r.status === "SUCCESS" ? "✅" : r.status === "FAILED" ? "❌" : "⏳";
      items.push({
        id: `geo-${r.id}`,
        ts: r.finishedAt.toISOString(),
        kind: "geo_run",
        icon,
        title: `${r.project.name} GEO run ${r.status}`,
        detail: `${r._count.results} 结果 · ${r.answeredQuestions ?? "-"}/${r.totalQuestions ?? "-"} 答`,
        href: `/geo/runs/${r.id}`,
      });
    }

    // 2) AuditLog 关键操作
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, action: true, targetType: true, targetId: true, userId: true, createdAt: true,
        user: { select: { email: true } },
      },
    });
    for (const a of auditLogs) {
      if (a.action === "USER_LOGIN" || a.action === "USER_LOGOUT") continue; // 太杂,跳过
      items.push({
        id: `audit-${a.id}`,
        ts: a.createdAt.toISOString(),
        kind: "audit",
        icon: "📋",
        title: `${a.user?.email ?? "系统"} ${a.action}`,
        detail: a.targetType ? `${a.targetType}${a.targetId ? `:${a.targetId.slice(-8)}` : ""}` : "",
      });
    }

    // 3) LLM 关键调用(失败或高 cost)
    const llmCalls = await prisma.llmCall.findMany({
      where: {
        ...(projectFilter ? { projectId: projectFilter } : {}),
        OR: [{ success: false }, { costCents: { gt: 5 } }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, provider: true, model: true, jobType: true, costCents: true, success: true,
        errorMessage: true, createdAt: true, projectId: true,
      },
    });
    for (const c of llmCalls) {
      items.push({
        id: `llm-${c.id}`,
        ts: c.createdAt.toISOString(),
        kind: "llm_call",
        icon: c.success ? "💰" : "⚠️",
        title: `${c.provider}/${c.model} ${c.jobType}`,
        detail: c.success
          ? `¥${(Number(c.costCents) / 100).toFixed(3)}`
          : `${c.errorMessage?.slice(0, 60) ?? "fail"}`,
      });
    }

    // 按时间排序
    items.sort((a, b) => b.ts.localeCompare(a.ts));
    const top = items.slice(0, limit);

    return success({
      range: { limit },
      items: top,
      totalEvents: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
