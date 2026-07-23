// 项目 AI 洞察生成器。
// 输入:项目 ID + 近 N 天真实业务数据(audit / GEO / mentions / distribution / drafts)
// 输出:结构化洞察(JSON),由 LLM 生成,Redis 缓存 24h。
// LLM 失败时降级到规则启发式,确保 0 LLM 也能返回可读的洞察。
// 环境变量由 Next.js 在 server 运行时从 .env 自动加载,这里不再显式 import dotenv。

import { prisma } from "@/lib/db";
import { redis } from "@/lib/queue";
import { getLLMProvider } from "@/lib/llm";

const DAY = 24 * 60 * 60 * 1000;

export interface InsightItem {
  title: string;
  rationale: string;
  metric?: string;
  href?: string;
}

export interface ActionItem extends InsightItem {
  steps: string[];
  priority: "P0" | "P1" | "P2";
}

export interface ProjectInsights {
  projectId: string;
  generatedAt: string;
  cachedUntil: string;
  source: "llm" | "heuristic";
  headline: string;
  summary: string;
  opportunities: InsightItem[];
  threats: InsightItem[];
  actions: ActionItem[];
  stats: {
    audits: number;
    avgScore: number;
    lowScorePages: number;
    geoRuns: number;
    geoSuccessRate: number;
    mentions: number;
    negativeMentions: number;
    distributionSuccessRate: number;
    pendingDrafts: number;
  };
}

const CACHE_PREFIX = "insights:v1:";
const CACHE_TTL_SEC = 24 * 60 * 60;

async function getCached(projectId: string): Promise<ProjectInsights | null> {
  try {
    const raw = await redis.get(CACHE_PREFIX + projectId);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectInsights;
  } catch {
    return null;
  }
}

async function setCached(insights: ProjectInsights): Promise<void> {
  try {
    await redis.set(
      CACHE_PREFIX + insights.projectId,
      JSON.stringify(insights),
      "EX",
      CACHE_TTL_SEC,
    );
  } catch {
    // 缓存失败不影响返回
  }
}

interface DataSnapshot {
  audits: Array<{ id: string; score: number; createdAt: string; pageUrl: string; pageTitle: string | null }>;
  avgScore: number;
  lowScorePages: Array<{ url: string; title: string | null; score: number; href: string }>;
  geoRuns: number;
  geoSuccessCount: number;
  geoFailedCount: number;
  geoPartialCount: number;
  mentions: Array<{ source: string; sentiment: string | null; title: string }>;
  negativeMentions: number;
  positiveMentions: number;
  distLogs: Array<{ status: string; platform: string }>;
  draftsByStatus: Record<string, number>;
  topQuestions: Array<{ text: string; mentioned: boolean; recommended: boolean; avgPosition: number | null }>;
}

async function collectSnapshot(projectId: string, fromDays = 7): Promise<DataSnapshot> {
  const since = new Date(Date.now() - fromDays * DAY);

  const [
    recentAudits,
    geoRuns,
    mentions,
    distLogs,
    drafts,
    targets,
  ] = await Promise.all([
    prisma.pageAudit.findMany({
      where: { page: { projectId }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { page: { select: { url: true, title: true, id: true } } },
    }),
    prisma.geoRun.findMany({
      where: { projectId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { results: { select: { primaryBrandMentioned: true, primaryBrandRecommended: true, position: true, sentiment: true, geoQuestion: { select: { question: true } } } } },
    }),
    prisma.brandMention.findMany({
      where: { projectId, discoveredAt: { gte: since } },
      orderBy: { discoveredAt: "desc" },
      take: 50,
      select: { source: true, sentiment: true, title: true },
    }),
    prisma.distributionLog.findMany({
      where: { target: { projectId }, createdAt: { gte: since } },
      include: { target: { select: { platform: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contentDraft.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: { status: true },
    }),
    prisma.distributionTarget.findMany({
      where: { projectId },
      select: { id: true, name: true, platform: true },
    }),
  ]);

  // 按页聚合最近一次审计 score
  const latestByPage = new Map<string, typeof recentAudits[number]>();
  for (const a of recentAudits) {
    if (!latestByPage.has(a.pageId)) latestByPage.set(a.pageId, a);
  }
  const auditsArr = Array.from(latestByPage.values());

  const avgScore = auditsArr.length
    ? Math.round(auditsArr.reduce((s, a) => s + a.score, 0) / auditsArr.length)
    : 0;

  const lowScorePages = auditsArr
    .filter((a) => a.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((a) => ({
      url: a.page.url,
      title: a.page.title,
      score: a.score,
      href: `/audits/${a.id}?projectId=${projectId}`,
    }));

  const geoSuccessCount = geoRuns.filter((r) => r.status === "SUCCESS").length;
  const geoPartialCount = geoRuns.filter((r) => r.status === "PARTIAL_FAILURE").length;
  const geoFailedCount = geoRuns.filter((r) => r.status === "FAILED").length;

  // 收集所有问题+提及率
  const questionMap = new Map<string, { text: string; positions: number[]; mentioned: number; recommended: number }>();
  for (const run of geoRuns) {
    for (const r of run.results) {
      const q = r.geoQuestion.question;
      if (!questionMap.has(q)) questionMap.set(q, { text: q, positions: [], mentioned: 0, recommended: 0 });
      const v = questionMap.get(q)!;
      if (typeof r.position === "number") v.positions.push(r.position);
      if (r.primaryBrandMentioned) v.mentioned += 1; if (r.primaryBrandRecommended) v.recommended += 1;
    }
  }
  const topQuestions = Array.from(questionMap.values())
    .map((q) => ({
      text: q.text,
      mentioned: q.mentioned > 0,
      recommended: q.recommended > 0,
      avgPosition: q.positions.length ? Math.round(q.positions.reduce((s, n) => s + n, 0) / q.positions.length) : null,
    }))
    .sort((a, b) => (a.mentioned === b.mentioned ? (a.avgPosition ?? 999) - (b.avgPosition ?? 999) : a.mentioned ? 1 : -1))
    .slice(0, 10);

  const draftsByStatus: Record<string, number> = {};
  for (const d of drafts) draftsByStatus[d.status] = (draftsByStatus[d.status] ?? 0) + 1;

  void targets; // 引用保留,未来可加入

  return {
    audits: auditsArr.map((a) => ({
      id: a.id,
      score: a.score,
      createdAt: a.createdAt.toISOString(),
      pageUrl: a.page.url,
      pageTitle: a.page.title,
    })),
    avgScore,
    lowScorePages,
    geoRuns: geoRuns.length,
    geoSuccessCount,
    geoFailedCount,
    geoPartialCount,
    mentions: mentions.map((m) => ({
      source: m.source,
      sentiment: m.sentiment,
      title: m.title,
    })),
    negativeMentions: mentions.filter((m) => m.sentiment === "NEGATIVE").length,
    positiveMentions: mentions.filter((m) => m.sentiment === "POSITIVE").length,
    distLogs: distLogs.map((d) => ({ status: d.status, platform: d.target.platform })),
    draftsByStatus,
    topQuestions,
  };
}

function buildHeuristicInsights(snap: DataSnapshot, projectId: string): ProjectInsights {
  const opportunities: InsightItem[] = [];
  const threats: InsightItem[] = [];
  const actions: ActionItem[] = [];

  // 机会 1:低分页
  if (snap.lowScorePages.length > 0) {
    const top = snap.lowScorePages[0];
    opportunities.push({
      title: `优化低分页: ${top.title ?? top.url}`,
      rationale: `该页 SEO 评分仅 ${top.score},显著低于项目均分 ${snap.avgScore},改进空间最大`,
      metric: `score=${top.score}`,
      href: top.href,
    });
    actions.push({
      title: `针对 ${top.url} 生成优化草稿`,
      rationale: `该页评分 ${top.score},基于关键词可生成符合 SEO 规范的内容`,
      steps: [
        `查看审计详情:`,
        `基于审计发现 + 项目关键词生成内容草稿`,
        `审核通过后分发到 webhook / 渠道`,
      ],
      priority: top.score < 30 ? "P0" : top.score < 50 ? "P1" : "P2",
      href: top.href,
    });
  }

  // 机会 2:未提及关键词
  const unmentioned = snap.topQuestions.filter((q) => !q.mentioned);
  if (unmentioned.length > 0) {
    opportunities.push({
      title: `${unmentioned.length} 个核心问题未被 AI 搜索引擎提及`,
      rationale: `近 7 天 GEO 运行覆盖了多个用户问题,但品牌未出现在回答中。补充针对这些问题的内容可提升引用率`,
      metric: `unmentioned=${unmentioned.length}`,
    });
    actions.push({
      title: `为高价值未提及问题生成内容`,
      rationale: `挑出搜索量/相关度最高的前 3 个问题,生成结构化答案`,
      steps: unmentioned.slice(0, 3).map((q, i) => `${i + 1}. 围绕"${q.text}"撰写权威答案(800-1200 字,含 FAQ schema)`),
      priority: "P1",
    });
  }

  // 威胁 1:GEO 失败
  if (snap.geoFailedCount > 0) {
    threats.push({
      title: `${snap.geoFailedCount} 次 GEO 运行失败`,
      rationale: `近 7 天有 GEO 运行 FAILED,可能 LLM 渠道配额 / 网络 / 限流问题`,
      metric: `failed=${snap.geoFailedCount}/${snap.geoRuns}`,
    });
    actions.push({
      title: `排查 GEO 失败原因`,
      rationale: `失败可能是临时性问题,但持续失败需要切换渠道或扩大配额`,
      steps: [
        `查看 GEO 运行列表,点开失败 run 详情`,
        `检查 LLM 渠道健康(LLM 用量页)`,
        `必要时切换备用 provider(openai_compatible / ark)`,
      ],
      priority: snap.geoFailedCount > 3 ? "P0" : "P1",
    });
  }

  // 威胁 2:负面 mentions
  if (snap.negativeMentions > 0) {
    threats.push({
      title: `${snap.negativeMentions} 条负面品牌提及`,
      rationale: `近期品牌监控发现负面情绪内容,需要主动响应`,
      metric: `negative=${snap.negativeMentions}`,
    });
    actions.push({
      title: `制定负面提及响应计划`,
      rationale: `建议优先回应高曝光渠道的负面提及,转化为品牌正面资产`,
      steps: [
        `打开品牌监控,过滤 sentiment=negative`,
        `对每条提及评估严重程度和需要响应程度`,
        `组织官方回应或内容覆盖`,
      ],
      priority: snap.negativeMentions > 5 ? "P0" : "P1",
    });
  }

  // 威胁 3:分发失败
  const distFailed = snap.distLogs.filter((d) => d.status === "FAILED").length;
  const distTotal = snap.distLogs.length;
  if (distTotal > 0 && distFailed / distTotal > 0.2) {
    threats.push({
      title: `分发失败率 ${Math.round((distFailed / distTotal) * 100)}%`,
      rationale: `近 7 天分发失败率超过 20%,渠道配置可能有问题`,
      metric: `failed=${distFailed}/${distTotal}`,
    });
    actions.push({
      title: `排查高失败率渠道`,
      rationale: `失败可能集中在某个平台(微信/知乎/百家号 webhook 配置)`,
      steps: [
        `查看分发日志详情`,
        `对每个平台单独测试连接`,
        `修复或临时禁用失败渠道`,
      ],
      priority: "P1",
    });
  }

  // 行动:待审稿
  const pending = (snap.draftsByStatus.PENDING_REVIEW ?? 0) + (snap.draftsByStatus.DRAFT ?? 0);
  if (pending > 0) {
    actions.push({
      title: `审核 ${pending} 条待处理草稿`,
      rationale: `当前有 ${pending} 条草稿等待审核或修改,完成后才能分发`,
      steps: [
        `打开内容 -> 草稿列表,过滤 status=PENDING_REVIEW`,
        `逐条审核或调整,批准后触发分发`,
      ],
      priority: pending > 5 ? "P0" : "P2",
    });
  }

  // 如果全部为空,给一个干净的 baseline
  if (opportunities.length === 0 && threats.length === 0 && actions.length === 0) {
    opportunities.push({
      title: "数据静默期",
      rationale: "近 7 天未发现明显异常或机会,系统持续监控中",
      metric: `audits=${snap.audits.length}, geoRuns=${snap.geoRuns}, mentions=${snap.mentions.length}`,
    });
    actions.push({
      title: "建议建立每周例行:运行 1 次 GEO + 1 次 audit",
      rationale: "保持数据新鲜度,让洞察持续有意义",
      steps: [
        "周一对核心页面跑 1 次 audit",
        "周三对核心关键词跑 1 次 GEO run",
        "周五生成周报 + 查看 insights",
      ],
      priority: "P2",
    });
  }

  const distSuccess = snap.distLogs.filter((d) => d.status === "SUCCESS").length;
  const distTotal2 = snap.distLogs.length;
  const distributionSuccessRate = distTotal2 > 0 ? Math.round((distSuccess / distTotal2) * 100) : 0;
  const geoSuccessRate = snap.geoRuns > 0 ? Math.round((snap.geoSuccessCount / snap.geoRuns) * 100) : 0;

  const headline =
    snap.avgScore >= 70
      ? `项目健康度良好(${snap.avgScore}/100),保持节奏`
      : snap.avgScore >= 50
        ? `项目健康度中等(${snap.avgScore}/100),有优化空间`
        : snap.avgScore > 0
          ? `项目 SEO 评分偏低(${snap.avgScore}/100),优先修复低分页`
          : `尚无审计数据,先跑一次 audit 拿到基线`;

  const summary = `近 7 天: 审计 ${snap.audits.length} 次,均分 ${snap.avgScore}; GEO ${snap.geoRuns} 次(成功 ${snap.geoSuccessCount}); 品牌提及 ${snap.mentions.length} 条(负面 ${snap.negativeMentions}); 分发 ${distTotal2} 次(成功率 ${distributionSuccessRate}%)。`;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    cachedUntil: new Date(Date.now() + CACHE_TTL_SEC * 1000).toISOString(),
    source: "heuristic",
    headline,
    summary,
    opportunities,
    threats,
    actions,
    stats: {
      audits: snap.audits.length,
      avgScore: snap.avgScore,
      lowScorePages: snap.lowScorePages.length,
      geoRuns: snap.geoRuns,
      geoSuccessRate,
      mentions: snap.mentions.length,
      negativeMentions: snap.negativeMentions,
      distributionSuccessRate,
      pendingDrafts: pending,
    },
  };
}

const INSIGHT_SYSTEM = `你是 GEO-SEO 项目顾问。基于最近 7 天的真实业务数据,生成简洁、可执行的中文洞察。
要求:
- 输出严格 JSON,不要任何额外文本
- opportunities: 3 条以内,每条含 title / rationale / 可选 metric
- threats: 3 条以内,风险点
- actions: 3 条以内,优先级 P0/P1/P2,含 steps 数组(具体到本项目的步骤)
- headline: 一句话总结项目当前健康度
- summary: 2-3 句话的关键数字总结
- 聚焦"现在该做什么",而非"长期战略"`;

function buildPrompt(snap: DataSnapshot): string {
  const compact = {
    avgScore: snap.avgScore,
    lowScorePages: snap.lowScorePages.slice(0, 3).map((p) => ({ url: p.url, title: p.title, score: p.score })),
    geoRuns: snap.geoRuns,
    geoSuccessCount: snap.geoSuccessCount,
    geoFailedCount: snap.geoFailedCount,
    geoPartialCount: snap.geoPartialCount,
    mentions: snap.mentions.length,
    negativeMentions: snap.negativeMentions,
    positiveMentions: snap.positiveMentions,
    topUnmentioned: snap.topQuestions.filter((q) => !q.mentioned).slice(0, 5).map((q) => q.text),
    topRecommended: snap.topQuestions.filter((q) => q.recommended).slice(0, 5).map((q) => q.text),
    topMentioned: snap.topQuestions.filter((q) => q.mentioned).slice(0, 5).map((q) => q.text),
    distLogs: snap.distLogs.length,
    distFailed: snap.distLogs.filter((d) => d.status === "FAILED").length,
    draftsByStatus: snap.draftsByStatus,
  };
  return `项目近 7 天真实数据(JSON):\n${JSON.stringify(compact, null, 2)}\n\n请生成洞察 JSON,字段:\n{ "headline": string, "summary": string, "opportunities": [...], "threats": [...], "actions": [{ "title", "rationale", "steps": [...], "priority": "P0|P1|P2" }] }`;
}

async function tryLlmInsights(snap: DataSnapshot): Promise<ProjectInsights | null> {
  try {
    const provider = getLLMProvider();
    const raw = await provider.complete({
      system: INSIGHT_SYSTEM,
      prompt: buildPrompt(snap),
      temperature: 0.4,
      maxTokens: 1500,
      responseFormat: "json",
    });
    const parsed = JSON.parse(raw);

    const distSuccess = snap.distLogs.filter((d) => d.status === "SUCCESS").length;
    const distTotal2 = snap.distLogs.length;
    const distributionSuccessRate = distTotal2 > 0 ? Math.round((distSuccess / distTotal2) * 100) : 0;
    const geoSuccessRate = snap.geoRuns > 0 ? Math.round((snap.geoSuccessCount / snap.geoRuns) * 100) : 0;
    const pending = (snap.draftsByStatus.PENDING_REVIEW ?? 0) + (snap.draftsByStatus.DRAFT ?? 0);

    return {
      projectId: parsed.projectId ?? snap.lowScorePages[0]?.href?.split("=")[1] ?? "",
      generatedAt: new Date().toISOString(),
      cachedUntil: new Date(Date.now() + CACHE_TTL_SEC * 1000).toISOString(),
      source: "llm",
      headline: String(parsed.headline ?? "暂无标题"),
      summary: String(parsed.summary ?? ""),
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 5) : [],
      threats: Array.isArray(parsed.threats) ? parsed.threats.slice(0, 5) : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
      stats: {
        audits: snap.audits.length,
        avgScore: snap.avgScore,
        lowScorePages: snap.lowScorePages.length,
        geoRuns: snap.geoRuns,
        geoSuccessRate,
        mentions: snap.mentions.length,
        negativeMentions: snap.negativeMentions,
        distributionSuccessRate,
        pendingDrafts: pending,
      },
    };
  } catch {
    return null;
  }
}

export async function generateProjectInsights(
  projectId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<ProjectInsights> {
  if (!opts.forceRefresh) {
    const cached = await getCached(projectId);
    if (cached) return { ...cached, generatedAt: cached.generatedAt, cachedUntil: cached.cachedUntil };
  }

  const snap = await collectSnapshot(projectId, 7);

  const llmResult = await tryLlmInsights(snap);
  const final = llmResult ?? buildHeuristicInsights(snap, projectId);
  // projectId 兜底
  final.projectId = projectId;

  await setCached(final);
  return final;
}

export async function invalidateProjectInsights(projectId: string): Promise<void> {
  try {
    await redis.del(CACHE_PREFIX + projectId);
  } catch {
    // ignore
  }
}
