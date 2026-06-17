// 数据库 seed 脚本 — 完整版 v1.2。
// 创建：ADMIN + 3 个项目 + 品牌/竞品/关键词/问题/页面/任务/GEO 结果/草稿/通知 等。
// 用法: pnpm prisma:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026";

  console.log("==> Seeding database (v1.2 完整版)...");

  // ============= ADMIN =============
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "系统管理员",
      role: "ADMIN",
      passwordHash,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  });
  console.log(`==> ADMIN: ${admin.email}`);

  // 第二个普通用户
  const memberEmail = "editor@example.com";
  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    update: {},
    create: {
      email: memberEmail,
      name: "内容编辑",
      role: "MEMBER",
      passwordHash: await bcrypt.hash("Editor@2026", 10),
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  });

  // ============= 3 个项目 =============
  const projectSeeds = [
    {
      id: "seed-project-1",
      name: "示例项目（公司主站）",
      domain: "example.com",
      primaryBrand: "Acme",
      language: "zh-CN",
      region: "CN",
      sitemapUrl: "https://example.com/sitemap.xml",
    },
    {
      id: "seed-project-2",
      name: "AI 产品官网",
      domain: "ai-assistant.com",
      primaryBrand: "智小盒",
      language: "zh-CN",
      region: "CN",
      sitemapUrl: "https://ai-assistant.com/sitemap.xml",
    },
    {
      id: "seed-project-3",
      name: "海外 SaaS",
      domain: "saasglobal.io",
      primaryBrand: "SaaSify",
      language: "en-US",
      region: "US",
      sitemapUrl: "https://saasglobal.io/sitemap.xml",
    },
  ];

  const projects = [];
  for (const ps of projectSeeds) {
    const p = await prisma.project.upsert({
      where: { id: ps.id },
      update: {},
      create: {
        ...ps,
        robotsUrl: `${ps.domain.startsWith("http") ? "" : "https://"}${ps.domain}/robots.txt`,
        status: "ACTIVE",
        geoDailyEnabled: true,
        geoChannels: ["perplexity", "kimi", "doubao", "llm_simulation"],
      },
    });
    projects.push(p);

    // ADMIN + EDITOR 都有权限
    for (const u of [admin, member]) {
      await prisma.userProject.upsert({
        where: { userId_projectId: { userId: u.id, projectId: p.id } },
        update: {},
        create: {
          userId: u.id,
          projectId: p.id,
          role: u.id === admin.id ? "OWNER" : "EDITOR",
        },
      });
    }
  }

  // ============= 品牌 =============
  const brandSeeds = [
    { project: "seed-project-1", name: "Acme", aliases: ["Acme Inc", "Acme 公司", "acme"], products: ["Acme SEO", "Acme GEO"], description: "一家提供搜索可见度优化服务的公司", isPrimary: true },
    { project: "seed-project-1", name: "Acme Lab", aliases: ["实验室"], products: [], description: "Acme 旗下研究部门", isPrimary: false },
    { project: "seed-project-1", name: "Acme 云", aliases: ["AcmeCloud"], products: ["云审计", "云监测"], description: "云服务子品牌", isPrimary: false },
    { project: "seed-project-2", name: "智小盒", aliases: ["智小盒AI", "Zhixiaohe"], products: ["智小盒助手", "智小盒分析"], description: "AI 助手产品", isPrimary: true },
    { project: "seed-project-2", name: "智小盒 Pro", aliases: ["智小盒企业版"], products: [], description: "面向大型企业", isPrimary: false },
    { project: "seed-project-3", name: "SaaSify", aliases: ["SaaSify Inc"], products: ["SaaSify Analytics"], description: "Marketing analytics SaaS", isPrimary: true },
  ];
  for (const b of brandSeeds) {
    const existing = await prisma.brand.findFirst({
      where: { projectId: b.project, name: b.name },
    });
    if (!existing) {
      await prisma.brand.create({
        data: {
          projectId: b.project,
          name: b.name,
          aliases: b.aliases,
          products: b.products,
          description: b.description,
          isPrimary: b.isPrimary,
        },
      });
    }
  }

  // ============= 竞品 =============
  const competitorSeeds = [
    { project: "seed-project-1", name: "竞品A", domain: "competitor-a.com", aliases: ["Competitor A"] },
    { project: "seed-project-1", name: "竞品B", domain: "competitor-b.io", aliases: [] },
    { project: "seed-project-1", name: "竞品C", domain: "competitor-c.cn", aliases: ["CompC"] },
    { project: "seed-project-2", name: "ChatBox", domain: "chatbox.com.cn", aliases: [] },
    { project: "seed-project-2", name: "AI 微助手", domain: "ai-wz.cn", aliases: [] },
    { project: "seed-project-3", name: "Marketo", domain: "marketo.com", aliases: [] },
  ];
  for (const c of competitorSeeds) {
    const existing = await prisma.competitor.findFirst({
      where: { projectId: c.project, name: c.name },
    });
    if (!existing) {
      await prisma.competitor.create({
        data: {
          projectId: c.project,
          name: c.name,
          domain: c.domain,
          aliases: c.aliases,
        },
      });
    }
  }

  // ============= 关键词（每个项目 8-10 个） =============
  const keywordSeeds = [
    { project: "seed-project-1", text: "企业 SEO 工具", intent: "COMMERCIAL", priority: 1 },
    { project: "seed-project-1", text: "GEO 优化", intent: "INFORMATIONAL", priority: 1 },
    { project: "seed-project-1", text: "AI 搜索排名", intent: "INFORMATIONAL", priority: 2 },
    { project: "seed-project-1", text: "搜索可见度", intent: "INFORMATIONAL", priority: 2 },
    { project: "seed-project-1", text: "品牌监测", intent: "COMMERCIAL", priority: 3 },
    { project: "seed-project-1", text: "SEO 优化方案", intent: "COMMERCIAL", priority: 2 },
    { project: "seed-project-1", text: "GEO vs SEO 区别", intent: "COMPARISON", priority: 3 },
    { project: "seed-project-1", text: "AI 搜索优化", intent: "INFORMATIONAL", priority: 2 },
    { project: "seed-project-1", text: "Perplexity SEO", intent: "INFORMATIONAL", priority: 3 },
    { project: "seed-project-1", text: "豆包 SEO", intent: "INFORMATIONAL", priority: 3 },
    { project: "seed-project-2", text: "AI 助手", intent: "COMMERCIAL", priority: 1 },
    { project: "seed-project-2", text: "智能问答系统", intent: "INFORMATIONAL", priority: 2 },
    { project: "seed-project-2", text: "企业知识库 AI", intent: "COMMERCIAL", priority: 2 },
    { project: "seed-project-2", text: "AI 客服 搭建", intent: "COMMERCIAL", priority: 2 },
    { project: "seed-project-3", text: "marketing analytics", intent: "COMMERCIAL", priority: 1 },
    { project: "seed-project-3", text: "saas marketing tools", intent: "COMMERCIAL", priority: 2 },
  ];
  for (let i = 0; i < keywordSeeds.length; i++) {
    const k = keywordSeeds[i];
    await prisma.keyword.upsert({
      where: { id: `seed-kw-${i + 1}` },
      update: {},
      create: {
        id: `seed-kw-${i + 1}`,
        projectId: k.project,
        text: k.text,
        intent: k.intent as "COMMERCIAL" | "INFORMATIONAL" | "COMPARISON",
        priority: k.priority,
        language: k.project === "seed-project-3" ? "en-US" : "zh-CN",
        region: k.project === "seed-project-3" ? "US" : "CN",
      },
    });
  }

  // ============= GEO 问题 =============
  const questionSeeds = [
    { project: "seed-project-1", question: "最好的企业 SEO 工具有哪些？", intent: "COMMERCIAL" },
    { project: "seed-project-1", question: "如何做 GEO 优化？", intent: "INFORMATIONAL" },
    { project: "seed-project-1", question: "AI 搜索时代怎么提升品牌曝光？", intent: "INFORMATIONAL" },
    { project: "seed-project-1", question: "Acme 和其他竞品哪个更适合中小企业？", intent: "COMPARISON" },
    { project: "seed-project-1", question: "中国市场有哪些值得推荐的搜索优化服务商？", intent: "COMMERCIAL" },
    { project: "seed-project-1", question: "Perplexity 和 Kimi 哪个 SEO 监测更好？", intent: "COMPARISON" },
    { project: "seed-project-1", question: "2026 年 SEO 趋势是什么？", intent: "INFORMATIONAL" },
    { project: "seed-project-1", question: "GEO 和 SEO 有什么核心区别？", intent: "COMPARISON" },
    { project: "seed-project-2", question: "国内有哪些好用的 AI 助手？", intent: "COMMERCIAL" },
    { project: "seed-project-2", question: "中小企业需要 AI 助手吗？", intent: "INFORMATIONAL" },
    { project: "seed-project-2", question: "AI 助手和传统客服有什么不同？", intent: "COMPARISON" },
    { project: "seed-project-3", question: "best marketing analytics tools 2026", intent: "COMMERCIAL" },
    { project: "seed-project-3", question: "how to measure brand awareness online", intent: "INFORMATIONAL" },
  ];
  for (let i = 0; i < questionSeeds.length; i++) {
    const q = questionSeeds[i];
    await prisma.geoQuestion.upsert({
      where: { id: `seed-q-${i + 1}` },
      update: {},
      create: {
        id: `seed-q-${i + 1}`,
        projectId: q.project,
        question: q.question,
        intent: q.intent as "COMMERCIAL" | "INFORMATIONAL" | "COMPARISON",
        priority: 3,
        language: q.project === "seed-project-3" ? "en-US" : "zh-CN",
        region: q.project === "seed-project-3" ? "US" : "CN",
      },
    });
  }

  // ============= 页面 + 诊断 =============
  const pageSeeds = [
    { project: "seed-project-1", url: "https://example.com/", title: "Example Domain", wordCount: 139 },
    { project: "seed-project-1", url: "https://example.com/about", title: "关于我们 - Example", wordCount: 480 },
    { project: "seed-project-1", url: "https://example.com/products", title: "产品中心", wordCount: 720 },
    { project: "seed-project-2", url: "https://ai-assistant.com/", title: "智小盒 - 企业 AI 助手", wordCount: 1200 },
    { project: "seed-project-2", url: "https://ai-assistant.com/pricing", title: "价格方案 - 智小盒", wordCount: 540 },
    { project: "seed-project-3", url: "https://saasglobal.io/", title: "SaaSify - Marketing Analytics", wordCount: 850 },
  ];
  const createdPages = [];
  for (let i = 0; i < pageSeeds.length; i++) {
    const p = pageSeeds[i];
    const page = await prisma.page.upsert({
      where: { projectId_url: { projectId: p.project, url: p.url } },
      update: {},
      create: {
        projectId: p.project,
        url: p.url,
        title: p.title,
        description: `${p.title} - 了解更多产品与服务`,
        h1: p.title,
        wordCount: p.wordCount,
        lastCrawledAt: new Date(),
      },
    });
    createdPages.push(page);
  }

  // 为前 4 个页面创建诊断
  for (let i = 0; i < Math.min(4, createdPages.length); i++) {
    const p = createdPages[i];
    const score = [24, 65, 82, 45][i] ?? 50;
    const findings = [];
    if (score < 80) {
      findings.push({ code: "MISSING_META_DESCRIPTION", severity: "high", title: "缺少 meta description", description: "建议添加 80-160 字符的描述", recommendation: "添加 meta description" });
    }
    if (score < 70) {
      findings.push({ code: "TITLE_TOO_SHORT", severity: "medium", title: "title 过短", description: "title 不够长", recommendation: "扩展 title 至 20-60 字符" });
    }
    if (score < 60) {
      findings.push({ code: "LOW_WORD_COUNT", severity: "medium", title: "字数过少", description: "正文不足 300 字", recommendation: "扩展内容" });
    }
    await prisma.pageAudit.create({
      data: {
        pageId: p.id,
        score,
        statusCode: 200,
        indexable: true,
        findings,
        rawSnapshot: {
          title: p.title,
          description: p.description,
          h1: p.h1,
          wordCount: p.wordCount,
          internalLinkCount: 3,
          externalLinkCount: 1,
          imageCount: 2,
          crawlMethod: "fetch",
        },
      },
    });
  }

  // ============= 任务 =============
  const taskSeeds = [
    { project: "seed-project-1", title: "优化首页 title 标签为 50 字符", priority: 2, status: "TODO" },
    { project: "seed-project-1", title: "为所有页面添加 meta description", priority: 1, status: "DOING" },
    { project: "seed-project-1", title: "补充「GEO 优化」相关内容到博客", priority: 3, status: "TODO" },
    { project: "seed-project-1", title: "为产品页添加 Schema.org 结构化数据", priority: 2, status: "REVIEW" },
    { project: "seed-project-1", title: "添加 OG 元数据", priority: 3, status: "DONE" },
    { project: "seed-project-2", title: "为智小盒 Pro 写产品介绍", priority: 1, status: "TODO" },
    { project: "seed-project-2", title: "优化价格页 SEO", priority: 2, status: "DOING" },
    { project: "seed-project-3", title: "Add FAQ schema to landing page", priority: 2, status: "TODO" },
  ];
  for (let i = 0; i < taskSeeds.length; i++) {
    const t = taskSeeds[i];
    await prisma.optimizationTask.upsert({
      where: { id: `seed-task-${i + 1}` },
      update: {},
      create: {
        id: `seed-task-${i + 1}`,
        projectId: t.project,
        title: t.title,
        description: `为 ${t.project} 自动生成的任务`,
        sourceType: "CONTENT_ANALYSIS",
        sourceId: "seed",
        url: null,
        priority: t.priority,
        status: t.status as "TODO" | "DOING" | "REVIEW" | "DONE",
      },
    });
  }

  // ============= GEO 运行 + 结果 =============
  for (let i = 0; i < 3; i++) {
    const project = projects[i % projects.length];
    const questions = await prisma.geoQuestion.findMany({
      where: { projectId: project.id },
      take: 3,
    });
    const startedAt = new Date(Date.now() - (i + 1) * 24 * 3600 * 1000);
    const finishedAt = new Date(startedAt.getTime() + 5 * 60 * 1000);

    const run = await prisma.geoRun.create({
      data: {
        projectId: project.id,
        triggerType: "SCHEDULED",
        provider: "multi",
        model: "multi",
        status: "SUCCESS",
        questionIds: questions.map((q) => q.id),
        startedAt,
        finishedAt,
        retryCount: 0,
        errorMessage: null,
      },
    });

    for (const q of questions) {
      const primaryBrand = project.primaryBrand;
      const mentioned = i !== 1;  // 第二轮不提及
      await prisma.geoRunResult.create({
        data: {
          geoRunId: run.id,
          geoQuestionId: q.id,
          answer: `关于"${q.question}"的回答：根据市场调研，主要品牌包括 ${primaryBrand}、Ahrefs、SEMrush 等。${mentioned ? `${primaryBrand} 在该领域有显著优势。` : "其他几家厂商表现各有侧重。"}`,
          providerSource: "llm_simulation",
          providerAttempts: 1,
          citedUrls: mentioned
            ? [`https://${project.domain}/`, `https://${project.domain}/about`]
            : [`https://competitor-a.com/`],
          mentionedBrands: mentioned ? [primaryBrand, "Ahrefs", "SEMrush"] : ["Ahrefs", "SEMrush"],
          mentionedCompetitors: i === 0 ? ["竞品A", "竞品B"] : [],
          primaryBrandMentioned: mentioned,
          primaryBrandRecommended: mentioned && i === 0,
          sentiment: mentioned ? "positive" : "neutral",
          position: mentioned ? 1 : null,
          links: mentioned ? [`https://${project.domain}/`] : [],
          analysis: {
            summary: mentioned ? "主品牌被推荐" : "主品牌未提及",
            opportunities: mentioned ? [] : ["增加主品牌在内容中的提及"],
            actions: mentioned ? [] : ["SEO 内容优化", "GEO 优化"],
          },
        },
      });
    }
  }

  // ============= 内容草稿 =============
  const draftSeeds = [
    {
      project: "seed-project-1",
      title: "AI 搜索时代 SEO 优化全攻略",
      status: "DRAFT",
      sourceType: "AI_GENERATED",
      targetKeywords: ["AI 搜索", "SEO", "GEO"],
    },
    {
      project: "seed-project-1",
      title: "2026 年企业 GEO 监测最佳实践",
      status: "PENDING_REVIEW",
      sourceType: "AI_GENERATED",
      targetKeywords: ["GEO 监测", "企业 SEO"],
    },
    {
      project: "seed-project-1",
      title: "Acme 平台 vs 竞品：深度对比",
      status: "APPROVED",
      sourceType: "AI_REWRITTEN",
      targetKeywords: ["Acme", "对比"],
    },
    {
      project: "seed-project-2",
      title: "智小盒企业版：AI 助手新标杆",
      status: "PUBLISHED",
      sourceType: "AI_GENERATED",
      targetKeywords: ["智小盒", "企业 AI 助手"],
    },
  ];
  for (let i = 0; i < draftSeeds.length; i++) {
    const d = draftSeeds[i];
    await prisma.contentDraft.upsert({
      where: { id: `seed-draft-${i + 1}` },
      update: {},
      create: {
        id: `seed-draft-${i + 1}`,
        projectId: d.project,
        title: d.title,
        content: `# ${d.title}\n\n这是一篇关于 **${d.targetKeywords.join("、")}** 的文章。\n\n## 引言\n\n在 2026 年，AI 搜索重塑了用户的查询方式...\n\n## 核心策略\n\n1. 内容质量\n2. 实体权威\n3. 结构化数据\n\n## 结论\n\n企业需要同时关注 SEO 和 GEO。`,
        contentFormat: "html",
        excerpt: `本文深入分析 ${d.targetKeywords.join("、")}，给出实战建议。`,
        metaTitle: `${d.title} | 2026 实战指南`,
        metaDescription: `深入解读 ${d.title}，含 7 大核心策略和落地清单。立即查看。`,
        slug: d.title.toLowerCase().replace(/\s+/g, "-"),
        sourceType: d.sourceType as "AI_GENERATED" | "AI_REWRITTEN",
        sourcePrompt: `写一篇关于 ${d.title} 的文章`,
        targetUrl: null,
        targetKeywords: d.targetKeywords,
        status: d.status as "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED",
        authorId: admin.id,
        reviewerId: d.status === "PENDING_REVIEW" || d.status === "APPROVED" || d.status === "PUBLISHED" ? admin.id : null,
        reviewNotes: d.status === "PENDING_REVIEW" ? "请检查事实准确性" : null,
        submittedAt: d.status !== "DRAFT" ? new Date() : null,
        reviewedAt: d.status === "APPROVED" || d.status === "PUBLISHED" ? new Date() : null,
        publishedAt: d.status === "PUBLISHED" ? new Date() : null,
      },
    });
  }

  // ============= 告警通道 + 事件 =============
  await prisma.alertChannel.upsert({
    where: { id: "seed-alert-1" },
    update: {},
    create: {
      id: "seed-alert-1",
      name: "飞书主群",
      type: "FEISHU",
      config: { webhookUrl: "https://open.feishu.cn/hook/xxx" },
      active: true,
      events: ["GEO_RUN_FAILED", "DAILY_GEO_SUMMARY", "ANOMALY_DETECTED"],
    },
  });
  await prisma.alertChannel.upsert({
    where: { id: "seed-alert-2" },
    update: {},
    create: {
      id: "seed-alert-2",
      name: "邮件运维组",
      type: "EMAIL",
      config: { to: "ops@example.com" },
      active: true,
      events: ["GEO_RUN_FAILED", "ANOMALY_DETECTED"],
    },
  });
  await prisma.alertEvent.upsert({
    where: { id: "seed-event-1" },
    update: {},
    create: {
      id: "seed-event-1",
      channelId: "seed-alert-1",
      eventType: "DAILY_GEO_SUMMARY",
      payload: { success: 12, failed: 1, total: 13 },
      status: "SUCCESS",
      sentAt: new Date(Date.now() - 8 * 3600 * 1000),
    },
  });
  await prisma.alertEvent.upsert({
    where: { id: "seed-event-2" },
    update: {},
    create: {
      id: "seed-event-2",
      channelId: "seed-alert-2",
      eventType: "GEO_RUN_FAILED",
      payload: { error: "channel timeout", project: "示例项目" },
      status: "FAILED",
      errorMessage: "smtp connection refused",
      sentAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  // ============= 通知 =============
  const notifSeeds = [
    { user: admin.id, type: "DRAFT_APPROVED", title: "草稿《2026 GEO 最佳实践》已通过", content: "审核人：系统管理员" },
    { user: admin.id, type: "GEO_ANOMALY", title: "【GEO 异常】示例项目提及率突降 30%", content: "建议立即检查内容" },
    { user: member.id, type: "TASK_ASSIGNED", title: "你被分配了任务：优化首页 title", content: "截止：本周五" },
  ];
  for (let i = 0; i < notifSeeds.length; i++) {
    const n = notifSeeds[i];
    await prisma.notification.upsert({
      where: { id: `seed-notif-${i + 1}` },
      update: {},
      create: {
        id: `seed-notif-${i + 1}`,
        userId: n.user,
        type: n.type as "DRAFT_APPROVED" | "GEO_ANOMALY" | "TASK_ASSIGNED",
        title: n.title,
        content: n.content,
        link: "/notifications",
        read: i === 0,
      },
    });
  }

  // ============= 分发目标 =============
  const distSeeds = [
    { project: "seed-project-1", name: "知乎主账号", platform: "ZHIHU" },
    { project: "seed-project-1", name: "微信公众号", platform: "WECHAT_MP" },
    { project: "seed-project-1", name: "飞书云文档归档", platform: "FEISHU_DOC" },
  ];
  for (let i = 0; i < distSeeds.length; i++) {
    const d = distSeeds[i];
    const existing = await prisma.distributionTarget.findFirst({
      where: { projectId: d.project, name: d.name },
    });
    if (!existing) {
      await prisma.distributionTarget.create({
        data: {
          projectId: d.project,
          name: d.name,
          platform: d.platform as "ZHIHU" | "WECHAT_MP" | "FEISHU_DOC",
          config: {},
          active: true,
        },
      });
    }
  }

  // ============= 品牌监控 mentions =============
  const mentionSeeds = [
    {
      project: "seed-project-1",
      source: "duckduckgo",
      url: "https://news.example.com/acme-review",
      title: "Acme SEO 工具深度评测：值得中小企业入手吗？",
      content: "本文从功能、价格、效果三个维度评测 Acme 的搜索可见度优化平台...",
      brand: "Acme",
      type: "primary_brand",
      sentiment: "positive",
    },
    {
      project: "seed-project-1",
      source: "duckduckgo",
      url: "https://blog.csdn.net/seo-comparison",
      title: "2026 年 5 款主流 SEO 工具对比",
      content: "本文对比 Acme、Ahrefs、SEMrush、Moz、SpyFu...",
      brand: "Acme",
      type: "primary_brand",
      sentiment: "neutral",
    },
    {
      project: "seed-project-1",
      source: "duckduckgo",
      url: "https://www.zhihu.com/question/12345",
      title: "如何评价 Acme 的 GEO 监测功能？",
      content: "Acme 是国内少数提供 GEO 监测的厂商之一...",
      brand: "Acme",
      type: "primary_brand",
      sentiment: "positive",
    },
  ];
  for (let i = 0; i < mentionSeeds.length; i++) {
    const m = mentionSeeds[i];
    await prisma.brandMention.upsert({
      where: { id: `seed-mention-${i + 1}` },
      update: {},
      create: {
        id: `seed-mention-${i + 1}`,
        projectId: m.project,
        source: m.source,
        sourceUrl: m.url,
        title: m.title,
        content: m.content,
        mentionType: m.type,
        brandName: m.brand,
        sentiment: m.sentiment,
        publishedAt: new Date(Date.now() - (i + 1) * 12 * 3600 * 1000),
        relevanceScore: 80 - i * 5,
      },
    });
  }

  // ============= 审计日志 =============
  const auditSeeds = [
    { user: admin.id, action: "USER_LOGIN", targetType: "User", metadata: { provider: "credentials" } },
    { user: admin.id, action: "PROJECT_CREATE", targetType: "Project", targetId: "seed-project-1" },
    { user: admin.id, action: "KEYWORD_CREATE", targetType: "Keyword" },
    { user: admin.id, action: "GEO_RUN_TRIGGER", targetType: "GeoRun", metadata: { provider: "llm_simulation" } },
  ];
  for (let i = 0; i < auditSeeds.length; i++) {
    const a = auditSeeds[i];
    await prisma.auditLog.create({
      data: {
        userId: a.user,
        action: a.action as "USER_LOGIN" | "PROJECT_CREATE" | "KEYWORD_CREATE" | "GEO_RUN_TRIGGER",
        targetType: a.targetType,
        targetId: a.targetId ?? null,
        metadata: a.metadata ?? undefined,
        createdAt: new Date(Date.now() - (auditSeeds.length - i) * 3600 * 1000),
      },
    });
  }

  console.log("");
  console.log("========================================");
  console.log("  Seed 完成！");
  console.log("========================================");
  console.log("");
  console.log("  ADMIN 账号:");
  console.log(`    email:    ${adminEmail}`);
  console.log(`    password: ${adminPassword}`);
  console.log("");
  console.log("  EDITOR 账号:");
  console.log("    email:    editor@example.com");
  console.log("    password: Editor@2026");
  console.log("");
  console.log("  种子数据：");
  console.log(`    项目：     ${projectSeeds.length}`);
  console.log(`    品牌：     ${brandSeeds.length}`);
  console.log(`    竞品：     ${competitorSeeds.length}`);
  console.log(`    关键词：   ${keywordSeeds.length}`);
  console.log(`    GEO 问题： ${questionSeeds.length}`);
  console.log(`    页面：     ${pageSeeds.length}`);
  console.log(`    任务：     ${taskSeeds.length}`);
  console.log(`    草稿：     ${draftSeeds.length}`);
  console.log(`    告警通道： 2`);
  console.log(`    通知：     ${notifSeeds.length}`);
  console.log(`    品牌提及： ${mentionSeeds.length}`);
  console.log("");
  console.log("  ⚠️  生产环境请立刻修改密码！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
