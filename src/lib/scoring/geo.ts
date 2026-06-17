// GEO 指标计算（7 天滚动窗口）。
// 详细说明见 dev doc v1.2 7.2 节。
import { prisma } from "@/lib/db";

export interface GeoMetrics {
  // 主要观察指标
  brandMentioned: number;          // 7 天内主品牌被提及的问题数
  brandRecommended: number;        // 7 天内主品牌被推荐的问题数
  competitorSuppress: number;      // 7 天内竞品压制（竞品被推荐但主品牌未）问题数
  officialLink: number;            // 7 天内主品牌官网链接出现的问题数
  totalQuestions: number;          // 7 天内总问题数

  // 转化分数
  score: number;                   // 0-100
  scoreChange: number;             // 较上 7 天的变化

  // 趋势
  trend: "up" | "down" | "stable";
}

function calculateScore(m: {
  brandMentioned: number;
  brandRecommended: number;
  competitorSuppress: number;
  officialLink: number;
  totalQuestions: number;
}): number {
  if (m.totalQuestions === 0) return 0;
  const mentionRate = m.brandMentioned / m.totalQuestions;
  const recommendRate = m.brandRecommended / m.totalQuestions;
  const suppressRate = 1 - m.competitorSuppress / m.totalQuestions;
  const linkRate = m.officialLink / m.totalQuestions;

  // 满分 100
  return Math.round(
    mentionRate * 25 +
    recommendRate * 25 +
    suppressRate * 20 +
    linkRate * 10 +
    20,  // 基础分
  );
}

export async function calculateProjectGeoMetrics(projectId: string): Promise<GeoMetrics> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

  const [recent, previous] = await Promise.all([
    prisma.geoRunResult.findMany({
      where: {
        geoRun: { projectId },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.geoRunResult.findMany({
      where: {
        geoRun: { projectId },
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
  ]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brands: { where: { isPrimary: true } },
    },
  });
  const primaryBrand = project?.brands[0]?.name ?? project?.primaryBrand ?? "";

  function compute(results: typeof recent) {
    const brandMentioned = results.filter((r) => r.primaryBrandMentioned).length;
    const brandRecommended = results.filter((r) => r.primaryBrandRecommended).length;
    const officialLink = results.filter(
      (r) => r.citedUrls.some((u) => u.toLowerCase().includes(project?.domain?.toLowerCase() ?? "___")),
    ).length;
    const competitorSuppress = results.filter(
      (r) => r.mentionedCompetitors.length > 0 && !r.primaryBrandMentioned,
    ).length;
    return {
      brandMentioned,
      brandRecommended,
      competitorSuppress,
      officialLink,
      totalQuestions: results.length,
    };
  }

  const current = compute(recent);
  const previousM = compute(previous);
  const score = calculateScore(current);
  const previousScore = calculateScore(previousM);
  const diff = score - previousScore;

  let trend: "up" | "down" | "stable" = "stable";
  if (diff > 5) trend = "up";
  else if (diff < -5) trend = "down";

  return {
    ...current,
    score,
    scoreChange: diff,
    trend,
  };
}
