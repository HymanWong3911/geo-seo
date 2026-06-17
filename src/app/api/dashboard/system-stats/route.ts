// 系统级仪表盘统计：跨项目的分发/内容/任务/活动聚合。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession();
    const projectIds = await listUserProjectIds(session.user.id, session.user.role);

    const since30d = new Date(Date.now() - 30 * DAY);
    const since7d = new Date(Date.now() - 7 * DAY);
    const since1d = new Date(Date.now() - 1 * DAY);

    if (projectIds.length === 0) {
      return success({
        projects: 0,
        distribution: { total: 0, success: 0, failed: 0, pending: 0, successRate: 0, todayCount: 0 },
        content: { drafts: 0, approved: 0, published: 0, pending: 0 },
        tasks: { total: 0, todo: 0, doing: 0, review: 0, done: 0, completionRate: 0 },
        brandMentions: { total: 0, positive: 0, neutral: 0, negative: 0, last7d: 0 },
        audits: { total: 0, avgScore: 0, last7d: 0 },
        llmCalls: { total30d: 0, tokens30d: 0, cost30dCents: 0 },
        timeline: [],
        health: { db: true, redis: true },
      });
    }

    const targetIds = await prisma.distributionTarget.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const targetIdList = targetIds.map(t => t.id);

    const [distributionLogs, contentDrafts, tasks, mentions, audits, llmCalls, pageIds, geoRuns] = await Promise.all([
      targetIdList.length > 0 ? prisma.distributionLog.findMany({
        where: { targetId: { in: targetIdList } },
        select: { status: true, createdAt: true, sentAt: true },
      }) : Promise.resolve([]),
      prisma.contentDraft.findMany({
        where: { projectId: { in: projectIds } },
        select: { status: true, createdAt: true },
      }),
      prisma.optimizationTask.findMany({
        where: { projectId: { in: projectIds } },
        select: { status: true, createdAt: true, updatedAt: true },
      }),
      prisma.brandMention.findMany({
        where: { projectId: { in: projectIds } },
        select: { sentiment: true, discoveredAt: true },
      }),
      prisma.page.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true },
      }).then(pages => prisma.pageAudit.findMany({
        where: { pageId: { in: pages.map(p => p.id) } },
        select: { score: true, createdAt: true },
      })),
      prisma.llmCall.findMany({
        where: { createdAt: { gte: since30d } },
        select: { totalTokens: true, costCents: true, createdAt: true },
      }),
      Promise.resolve([]),
      prisma.geoRun.findMany({
        where: { projectId: { in: projectIds }, createdAt: { gte: since7d } },
        select: { id: true, createdAt: true, status: true },
      }),
    ]);

    // 分发统计
    const distSuccess = distributionLogs.filter(l => l.status === "SUCCESS").length;
    const distFailed = distributionLogs.filter(l => l.status === "FAILED").length;
    const distPending = distributionLogs.filter(l => l.status === "PENDING").length;
    const distToday = distributionLogs.filter(l => l.createdAt >= since1d).length;

    // 内容统计
    const draftApproved = contentDrafts.filter(d => d.status === "APPROVED").length;
    const draftPublished = contentDrafts.filter(d => d.status === "PUBLISHED").length;
    const draftPending = contentDrafts.filter(d => d.status === "PENDING_REVIEW" || d.status === "DRAFT").length;

    // 任务统计
    const taskTotal = tasks.length;
    const taskDone = tasks.filter(t => t.status === "DONE").length;
    const taskTodo = tasks.filter(t => t.status === "TODO").length;
    const taskDoing = tasks.filter(t => t.status === "DOING").length;
    const taskReview = tasks.filter(t => t.status === "REVIEW").length;

    // 品牌提及
    const mentionPositive = mentions.filter(m => (m.sentiment ?? "").toUpperCase() === "POSITIVE").length;
    const mentionNeutral = mentions.filter(m => (m.sentiment ?? "").toUpperCase() === "NEUTRAL").length;
    const mentionNegative = mentions.filter(m => (m.sentiment ?? "").toUpperCase() === "NEGATIVE").length;
    const mentionLast7d = mentions.filter(m => m.discoveredAt >= since7d).length;

    // 审计
    const auditLast7d = audits.filter(a => a.createdAt >= since7d).length;
    const avgScore = audits.length > 0 ? Math.round(audits.reduce((s, a) => s + (a.score ?? 0), 0) / audits.length) : 0;

    // LLM
    const llmTokens30d = llmCalls.reduce((s, c) => s + (c.totalTokens ?? 0), 0);
    const llmCost30dCents = llmCalls.reduce((s, c) => s + Number(c.costCents ?? 0), 0);

    // 7天时间线（每天的事件数）
    const timeline: Array<{ date: string; dist: number; geo: number; audit: number; task: number; mention: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(new Date().setHours(0, 0, 0, 0) - i * DAY);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      const dayKey = dayStart.toISOString().slice(0, 10);
      timeline.push({
        date: dayKey,
        dist: distributionLogs.filter(l => l.createdAt >= dayStart && l.createdAt < dayEnd).length,
        geo: geoRuns.filter(g => g.createdAt >= dayStart && g.createdAt < dayEnd).length,
        audit: audits.filter(a => a.createdAt >= dayStart && a.createdAt < dayEnd).length,
        task: tasks.filter(t => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
        mention: mentions.filter(m => m.discoveredAt >= dayStart && m.discoveredAt < dayEnd).length,
      });
    }

    return success({
      projects: projectIds.length,
      distribution: {
        total: distributionLogs.length,
        success: distSuccess,
        failed: distFailed,
        pending: distPending,
        successRate: distributionLogs.length > 0 ? Math.round((distSuccess / distributionLogs.length) * 100) : 0,
        todayCount: distToday,
      },
      content: {
        drafts: contentDrafts.length,
        approved: draftApproved,
        published: draftPublished,
        pending: draftPending,
      },
      tasks: {
        total: taskTotal,
        todo: taskTodo,
        doing: taskDoing,
        review: taskReview,
        done: taskDone,
        completionRate: taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0,
      },
      brandMentions: {
        total: mentions.length,
        positive: mentionPositive,
        neutral: mentionNeutral,
        negative: mentionNegative,
        last7d: mentionLast7d,
      },
      audits: {
        total: audits.length,
        avgScore,
        last7d: auditLast7d,
      },
      llmCalls: {
        total30d: llmCalls.length,
        tokens30d: llmTokens30d,
        cost30dCents: Math.round(llmCost30dCents),
      },
      timeline,
      health: { db: true, redis: true },
    });
  } catch (err) {
    return handleError(err);
  }
}
