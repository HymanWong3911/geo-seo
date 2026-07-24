// 单项目品牌/竞品提及 top list(按 sentiment + 频率排)。
// 投资人 demo 用:看哪些 brand 出现最多 + 哪些 positive/negative。
// 2026-07-23 新增。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      days: url.searchParams.get("days") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const { days, limit } = parsed.data;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const mentions = await prisma.brandMention.findMany({
      where: { projectId: params.projectId, discoveredAt: { gte: since } },
      orderBy: { discoveredAt: "desc" },
      take: 200,
    });

    // 按 brandName + sentiment 分组
    interface BrandStat {
      brandName: string;
      mentionType: string;
      positive: number;
      neutral: number;
      negative: number;
      total: number;
      latestAt: string;
    }
    const byBrand = new Map<string, BrandStat>();
    for (const m of mentions) {
      const key = `${m.brandName}::${m.mentionType}`;
      let s = byBrand.get(key);
      if (!s) {
        s = {
          brandName: m.brandName,
          mentionType: m.mentionType,
          positive: 0, neutral: 0, negative: 0, total: 0,
          latestAt: m.discoveredAt.toISOString(),
        };
        byBrand.set(key, s);
      }
      s.total += 1;
      const sent = (m.sentiment ?? "neutral").toLowerCase();
      if (sent === "positive") s.positive += 1;
      else if (sent === "negative") s.negative += 1;
      else s.neutral += 1;
      if (m.discoveredAt.toISOString() > s.latestAt) s.latestAt = m.discoveredAt.toISOString();
    }

    const all = Array.from(byBrand.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    // sentiment 总体分布
    const sentimentTotals = { positive: 0, neutral: 0, negative: 0 };
    for (const s of byBrand.values()) {
      sentimentTotals.positive += s.positive;
      sentimentTotals.neutral += s.neutral;
      sentimentTotals.negative += s.negative;
    }
    const total = sentimentTotals.positive + sentimentTotals.neutral + sentimentTotals.negative;
    const sentimentPct = {
      positive: total > 0 ? Math.round((sentimentTotals.positive / total) * 100) : 0,
      neutral: total > 0 ? Math.round((sentimentTotals.neutral / total) * 100) : 0,
      negative: total > 0 ? Math.round((sentimentTotals.negative / total) * 100) : 0,
    };

    return success({
      projectId: params.projectId,
      range: { days, since: since.toISOString() },
      totals: {
        totalMentions: total,
        uniqueBrands: byBrand.size,
        sentimentPct,
      },
      topBrands: all,
    });
  } catch (err) {
    return handleError(err);
  }
}
