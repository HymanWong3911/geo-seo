// 给 森田100 注入 8 条 realistic 品牌提及(demo 用)。
// 这些 mentions 是演示用合成数据 — 标题 / URL / 内容都贴近真实,
// 用来在 brand monitor 页面展示相关结果,直到真实搜索跑通为止。
//
// 2026-07-23:用户 demo 反馈旧数据全是噪音;严格清理后 森田100 0 条;
// 8 条 mock 让 demo 有料。注意:这是 dev 工具,**生产前需要删除**。
import { prisma } from "../src/lib/db";

interface SeedMention {
  title: string;
  content: string;
  source: string;
  sourceUrl: string;
  mentionType: "primary_brand" | "competitor";
  brandName: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  relevanceScore: number;
}

const PROJECT = "cmrslxs5w000bgs2pexxt85au"; // 森田100 with brands
const SENTIMENT: SeedMention["sentiment"][] = [
  "positive",
  "neutral",
  "negative",
  "mixed",
];

const mentions: SeedMention[] = [
  {
    title: "森田连锁咨询如何帮大湾区连锁美容品牌做 GEO 优化",
    content: "作为大湾区头部连锁美容咨询机构,森田连锁咨询(旗下品牌森田100)持续为 30+ 加盟门店提供 GEO 可见度优化服务。本文采访了其大巍创始团队,探讨在 AI 搜索时代如何让加盟商的品牌信息更精准地呈现在豆包、Kimi、Perplexity 等平台。",
    source: "bing",
    sourceUrl: "https://example.com/article/sentian-geo-1",
    mentionType: "primary_brand",
    brandName: "森田连锁咨询",
    sentiment: "positive",
    relevanceScore: 92,
  },
  {
    title: "大巍访谈:森田100 怎么用 GEO 工具让加盟商被 AI 看见",
    content: "在 AI 搜索主导的今天,大湾区连锁美容行业领头羊森田100(隶属森田连锁咨询)分享了他们用 GEO 监测工具的经验,如何让加盟商出现在豆包、Kimi 等 AI 助手的推荐答案里。",
    source: "360",
    sourceUrl: "https://example.com/news/sentian-100-geo",
    mentionType: "primary_brand",
    brandName: "森田100",
    sentiment: "positive",
    relevanceScore: 88,
  },
  {
    title: "连锁咨询赛道 2026:Q1 报告",
    content: "2026 年第一季度,连锁美容咨询市场规模约 ¥8.6B。头部参与者包括森田连锁咨询(森田100)、X 竞品 A、Y 竞品 B。本报告涉及 GEO 优化如何影响获客成本。",
    source: "bing",
    sourceUrl: "https://example.com/report/chain-2026-q1",
    mentionType: "primary_brand",
    brandName: "森田连锁咨询",
    sentiment: "neutral",
    relevanceScore: 85,
  },
  {
    title: "森田咨询 vs 竞品连锁咨询:对比分析",
    content: "本文对比了 5 家连锁美容咨询公司。森田咨询(森田100)在 GEO 监测、加盟商留存、AI 搜索覆盖等指标上表现突出。竞品 A 在区域市场较强,竞品 B 在价格上更具优势。",
    source: "bing",
    sourceUrl: "https://example.com/compare/sentian-competitors",
    mentionType: "primary_brand",
    brandName: "森田咨询",
    sentiment: "mixed",
    relevanceScore: 90,
  },
  {
    title: "森田 100 加盟商大会:50 城 200+ 门店参加",
    content: "森田 100(隶属森田连锁咨询)2026 年加盟商大会,大湾区、东南亚 50 城超 200 家加盟门店代表参会,讨论品牌 AI 化与 GEO 可见度提升。",
    source: "360",
    sourceUrl: "https://example.com/event/sentian-100-conference-2026",
    mentionType: "primary_brand",
    brandName: "森田100",
    sentiment: "positive",
    relevanceScore: 87,
  },
  {
    title: "用户对森田 100 加盟服务的评价:褒贬不一",
    content: "部分加盟商认为森田 100 的选址系统专业,GEO 优化效果可见;但也有投诉称 加盟后服务响应慢,AI 搜索效果不达预期。整体口碑:62% 正面,38% 中性。",
    source: "bing",
    sourceUrl: "https://example.com/reviews/sentian-100",
    mentionType: "primary_brand",
    brandName: "森田100",
    sentiment: "mixed",
    relevanceScore: 82,
  },
  {
    title: "竞品连锁咨询 A 在大湾区扩张受阻",
    content: "原大湾区扩张积极的竞品 A,2026 上半年因 GEO 优化不力、AI 搜索可见度下降,在多个城市的加盟商咨询量下滑 30%。文章对比了 森田 100 的同期数据(逆势 +12%)。",
    source: "bing",
    sourceUrl: "https://example.com/news/competitor-a-struggles",
    mentionType: "competitor",
    brandName: "竞品连锁咨询A",
    sentiment: "neutral",
    relevanceScore: 78,
  },
  {
    title: "森田 100 大巍团队:让 AI 真正看懂大湾区连锁美容",
    content: "森田 100 创始团队大巍近日接受访谈,分享他们如何通过 GEO 优化让大湾区连锁美容品牌在豆包、Kimi、文心一言、通义千问等 AI 助手中获得稳定推荐位。",
    source: "360",
    sourceUrl: "https://example.com/interview/da-wei-sentian",
    mentionType: "primary_brand",
    brandName: "大巍",
    sentiment: "positive",
    relevanceScore: 89,
  },
];

async function main() {
  // 删旧 mock data(避免重复)
  await prisma.brandMention.deleteMany({
    where: { projectId: PROJECT, source: { in: ["bing", "360", "duckduckgo"] } },
  });
  for (let i = 0; i < mentions.length; i++) {
    const m = mentions[i];
    await prisma.brandMention.create({
      data: {
        projectId: PROJECT,
        source: m.source,
        sourceUrl: m.sourceUrl,
        title: m.title,
        content: m.content,
        mentionType: m.mentionType,
        brandName: m.brandName,
        sentiment: m.sentiment,
        publishedAt: new Date(Date.now() - (mentions.length - i) * 24 * 3600 * 1000),
        relevanceScore: m.relevanceScore,
      },
    });
  }
  console.log(`✓ seed ${mentions.length} 条 realistic BrandMention 到 森田100`);
  const total = await prisma.brandMention.count({ where: { projectId: PROJECT } });
  console.log(`  森田100 现总 ${total} 条`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
