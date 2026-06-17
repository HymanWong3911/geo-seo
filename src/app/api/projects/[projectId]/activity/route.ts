// 项目活动流：按天聚合最近 30 天的关键事件。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireProjectEditor, requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const projectId = params.projectId;
    const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "30"), 90);
    const since = new Date(Date.now() - days * DAY);

    // 各维度事件查询（按天聚合）
    const [geoRuns, audits, tasksCreated, tasksCompleted, drafts, mentions] = await Promise.all([
      prisma.geoRun.findMany({
        where: { projectId, createdAt: { gte: since } },
        select: { createdAt: true, status: true },
      }),
      prisma.pageAudit.findMany({
        where: { page: { projectId }, createdAt: { gte: since } },
        select: { createdAt: true, score: true },
      }),
      prisma.optimizationTask.findMany({
        where: { projectId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.optimizationTask.findMany({
        where: { projectId, status: "DONE", updatedAt: { gte: since } },
        select: { updatedAt: true },
      }),
      prisma.contentDraft.findMany({
        where: { projectId, createdAt: { gte: since } },
        select: { createdAt: true, status: true },
      }),
      prisma.brandMention.findMany({
        where: { projectId, discoveredAt: { gte: since } },
        select: { discoveredAt: true, sentiment: true },
      }),
    ]);

    // 按天分桶
    const buckets = new Map<string, {
      date: string;
      geoRuns: number;
      geoSuccess: number;
      audits: number;
      avgScore: number | null;
      tasksCreated: number;
      tasksCompleted: number;
      draftsCreated: number;
      mentionsFound: number;
    }>();

    function dateKey(d: Date): string {
      return d.toISOString().slice(0, 10);
    }
    function getBucket(d: Date) {
      const k = dateKey(d);
      if (!buckets.has(k)) {
        buckets.set(k, {
          date: k,
          geoRuns: 0,
          geoSuccess: 0,
          audits: 0,
          avgScore: null,
          tasksCreated: 0,
          tasksCompleted: 0,
          draftsCreated: 0,
          mentionsFound: 0,
        });
      }
      return buckets.get(k)!;
    }

    const scoreSums = new Map<string, { sum: number; n: number }>();

    for (const r of geoRuns) {
      const b = getBucket(r.createdAt);
      b.geoRuns++;
      if (r.status === "SUCCESS" || r.status === "PARTIAL_FAILURE") b.geoSuccess++;
    }
    for (const a of audits) {
      const b = getBucket(a.createdAt);
      b.audits++;
      const k = b.date;
      const cur = scoreSums.get(k) ?? { sum: 0, n: 0 };
      cur.sum += a.score;
      cur.n++;
      scoreSums.set(k, cur);
    }
    for (const t of tasksCreated) {
      getBucket(t.createdAt).tasksCreated++;
    }
    for (const t of tasksCompleted) {
      getBucket(t.updatedAt).tasksCompleted++;
    }
    for (const d of drafts) {
      getBucket(d.createdAt).draftsCreated++;
    }
    for (const m of mentions) {
      getBucket(m.discoveredAt).mentionsFound++;
    }

    for (const [k, v] of scoreSums) {
      const b = buckets.get(k)!;
      b.avgScore = Math.round(v.sum / v.n);
    }

    // 输出按日期排序
    const series = Array.from(buckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // 累计
    const totals = {
      geoRuns: geoRuns.length,
      geoSuccessRate: geoRuns.length > 0
        ? Math.round((geoRuns.filter((r) => r.status === "SUCCESS" || r.status === "PARTIAL_FAILURE").length / geoRuns.length) * 100)
        : 0,
      audits: audits.length,
      avgScore: audits.length > 0 ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length) : 0,
      tasksCreated: tasksCreated.length,
      tasksCompleted: tasksCompleted.length,
      draftsCreated: drafts.length,
      mentionsFound: mentions.length,
    };

    return success({
      days,
      series,
      totals,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}