// 单项目 LLM 用量端点(per-project 拆解)。
// 用法:GET /api/projects/{p}/llm/usage?days=30
// 返回:calls / tokens / cost(yuan) / 按 jobType / 按 model / 按 day 趋势。
// 2026-07-23 新增,dashboard 趋势图、investor demo 用 — 多项目管理员要按项目看开支。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const days = parsed.data.days;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    // 只查这个项目的 GEO run 的 LlmCall (projectId 通过 geoRunId 关联)
    const projectGeoRuns = await prisma.geoRun.findMany({
      where: { projectId: params.projectId },
      select: { id: true },
    });
    const runIds = projectGeoRuns.map((r) => r.id);
    const where = {
      createdAt: { gte: since },
      OR: [
        { projectId: params.projectId },
        { geoRunId: { in: runIds } },
      ],
    };

    const [totals, byModel, byJobType, byDay] = await Promise.all([
      prisma.llmCall.aggregate({
        where,
        _count: { id: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
        _avg: { durationMs: true },
      }),
      prisma.llmCall.groupBy({
        by: ["model", "provider"],
        where,
        _count: { id: true },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.llmCall.groupBy({
        by: ["jobType"],
        where,
        _count: { id: true },
        _sum: { totalTokens: true, costCents: true },
      }),
      prisma.$queryRaw<Array<{ day: Date; calls: bigint; tokens: bigint; cost: number }>>`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*) AS calls,
          SUM("totalTokens") AS tokens,
          COALESCE(SUM("costCents"), 0)::float AS cost
        FROM "LlmCall"
        WHERE "createdAt" >= ${since}
          AND ("projectId" = ${params.projectId} OR "geoRunId" = ANY(${runIds}::text[]))
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY day DESC
      `,
    ]);

    return success({
      projectId: params.projectId,
      range: { days, since: since.toISOString() },
      totals: {
        calls: totals._count.id,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        costCents: Number(totals._sum.costCents ?? 0),
        costYuan: Number(((totals._sum.promptTokens ?? 0) + (totals._sum.completionTokens ?? 0)) * 0.000005), // 粗估
        avgDurationMs: Math.round(totals._avg.durationMs ?? 0),
      },
      byModel: byModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        calls: m._count.id,
        tokens: m._sum.totalTokens ?? 0,
        promptTokens: m._sum.promptTokens ?? 0,
        completionTokens: m._sum.completionTokens ?? 0,
        costCents: Number(m._sum.costCents ?? 0),
      })),
      byJobType: byJobType.map((j) => ({
        jobType: j.jobType,
        calls: j._count.id,
        tokens: j._sum.totalTokens ?? 0,
        costCents: Number(j._sum.costCents ?? 0),
      })),
      byDay: byDay.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        calls: Number(d.calls),
        tokens: Number(d.tokens),
        costCents: Number(d.cost),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
