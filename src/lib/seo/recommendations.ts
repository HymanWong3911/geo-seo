// SEO 优化建议生成器
// 基于诊断结果生成可执行的具体建议

import type { Finding } from "./analyzer";

export interface SeoRecommendation {
  code: string;
  title: string;
  priority: 1 | 2 | 3; // 1=紧急, 2=重要, 3=可选
  impact: "high" | "medium" | "low"; // 对 SEO 的影响程度
  effort: "low" | "medium" | "high"; // 实现难度
  category: "content" | "technical" | "performance" | "links" | "metadata";
  
  // 详细说明
  description: string;
  
  // 具体步骤
  steps: string[];
  
  // 代码示例（如果有）
  codeExample?: string;
  
  // 参考资料
  references?: string[];
  
  // 预期收益
  expectedBenefit: string;
}

interface RecommendationContext {
  url: string;
  findings: Finding[];
  pageType?: "homepage" | "article" | "product" | "category" | "landing" | "other";
}

// 根据页面类型调整建议优先级
function adjustPriorityForPageType(code: string, pageType: string): number {
  const typePriorityMap: Record<string, Record<string, number>> = {
    homepage: {
      "MISSING_META_DESCRIPTION": 2,
      "MISSING_SCHEMA": 2,
      "LOW_WORD_COUNT": 1,
    },
    article: {
      "MISSING_META_DESCRIPTION": 2,
      "TITLE_TOO_SHORT": 2,
      "LOW_WORD_COUNT": 1,
      "MISSING_H1": 2,
    },
    product: {
      "MISSING_SCHEMA": 1,
      "LOW_WORD_COUNT": 2,
    },
  };
  
  return typePriorityMap[pageType]?.[code] ?? 3;
}

// 生成详细建议
function generateRecommendations(ctx: RecommendationContext): SeoRecommendation[] {
  const recommendations: SeoRecommendation[] = [];
  
  for (const finding of ctx.findings) {
    const rec = getRecommendationForCode(finding.code, finding, ctx);
    if (rec) {
      recommendations.push(rec);
    }
  }
  
  // 按优先级和影响程度排序
  recommendations.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
  
  return recommendations;
}

function getRecommendationForCode(code: string, finding: Finding, ctx: RecommendationContext): SeoRecommendation | null {
  const recs: Record<string, SeoRecommendation> = {
    // Title 相关
    MISSING_TITLE: {
      code: "MISSING_TITLE",
      title: "添加页面标题",
      priority: 1,
      impact: "high",
      effort: "low",
      category: "metadata",
      description: "页面缺少 <title> 标签，搜索引擎无法正确索引页面。",
      steps: [
        `在 <head> 部分添加 <title> 标签`,
        `标题应包含核心关键词（1-3个）`,
        `控制在 20-60 字符之间`,
        `品牌名放在最后，用 | 或 - 分隔`,
      ],
      codeExample: `<title>核心关键词1 | 核心关键词2 - 品牌名</title>`,
      references: [
        "https://developers.google.com/search/docs/crawling-indexing/special-tags",
      ],
      expectedBenefit: "提升搜索结果展示效果，增加点击率",
    },
    TITLE_TOO_SHORT: {
      code: "TITLE_TOO_SHORT",
      title: "扩展页面标题",
      priority: 2,
      impact: "medium",
      effort: "low",
      category: "metadata",
      description: `当前标题 "${finding.currentValue}" 过短，影响搜索结果展示。`,
      steps: [
        "扩展标题至 20-60 字符",
        "在标题开头添加核心关键词",
        "确保标题准确描述页面内容",
      ],
      codeExample: `<title>核心关键词 - 详细描述页面内容 | 品牌名</title>`,
      expectedBenefit: "搜索结果摘要更丰富，吸引更多点击",
    },
    TITLE_TOO_LONG: {
      code: "TITLE_TOO_LONG",
      title: "精简页面标题",
      priority: 2,
      impact: "medium",
      effort: "low",
      category: "metadata",
      description: `当前标题 "${finding.currentValue}" 过长，会被搜索结果截断。`,
      steps: [
        "精简标题至 60 字符以内",
        "核心内容放在最前面",
        "删除冗余词汇",
      ],
      codeExample: `<title>核心关键词1 - 核心关键词2 - 品牌名</title>`,
      expectedBenefit: "标题完整显示，避免核心信息丢失",
    },
    
    // Meta Description
    MISSING_META_DESCRIPTION: {
      code: "MISSING_META_DESCRIPTION",
      title: "添加 Meta Description",
      priority: 2,
      impact: "high",
      effort: "low",
      category: "metadata",
      description: "页面缺少 meta description，影响搜索结果摘要展示。",
      steps: [
        "在 <head> 部分添加 meta description",
        "控制在 80-160 字符",
        "包含核心关键词和独特卖点",
        "添加号召性用语（如「立即了解」）",
      ],
      codeExample: `<meta name="description" content="描述页面内容的核心要点，包含关键词，突出独特价值，80-160字符">`,
      references: [
        "https://developers.google.com/search/docs/crawling-indexing/special-tags",
      ],
      expectedBenefit: "提高搜索结果点击率，展示品牌信息",
    },
    META_DESC_TOO_LONG: {
      code: "META_DESC_TOO_LONG",
      title: "精简 Meta Description",
      priority: 3,
      impact: "low",
      effort: "low",
      category: "metadata",
      description: "meta description 过长，会被截断。",
      steps: [
        "精简描述至 160 字符以内",
        "确保重要信息在前 80 字符内",
      ],
      expectedBenefit: "完整展示关键信息",
    },
    
    // Heading 结构
    MISSING_H1: {
      code: "MISSING_H1",
      title: "添加 H1 标题",
      priority: 1,
      impact: "high",
      effort: "low",
      category: "content",
      description: "页面缺少 H1 标题，搜索引擎无法确定页面主题。",
      steps: [
        "添加一个 <h1> 标签",
        "包含页面核心关键词",
        "与 title 保持一致或相近",
        "每个页面只能有一个 H1",
      ],
      codeExample: `<h1>页面核心主题 - 核心关键词</h1>`,
      expectedBenefit: "帮助搜索引擎理解页面主题，提升相关关键词排名",
    },
    MULTIPLE_H1: {
      code: "MULTIPLE_H1",
      title: "只保留一个 H1",
      priority: 2,
      impact: "medium",
      effort: "medium",
      category: "content",
      description: "页面有多个 H1 标签，影响页面结构。",
      steps: [
        "将多余的 H1 降级为 H2-H6",
        "确保只有一个 H1 包含核心主题",
      ],
      expectedBenefit: "清晰的页面结构，提升 SEO 效果",
    },
    TITLE_H1_MISMATCH: {
      code: "TITLE_H1_MISMATCH",
      title: "标题与 H1 保持一致",
      priority: 3,
      impact: "low",
      effort: "low",
      category: "content",
      description: "title 和 H1 内容不匹配，可能影响排名。",
      steps: [
        "确保 H1 与 title 包含相同的核心关键词",
        "H1 可以比 title 更详细",
      ],
      expectedBenefit: "关键词强调一致，提升排名效果",
    },
    
    // 内容
    LOW_WORD_COUNT: {
      code: "LOW_WORD_COUNT",
      title: "增加页面内容",
      priority: 2,
      impact: "high",
      effort: "high",
      category: "content",
      description: `页面内容过少（${finding.currentValue}字符），可能被视为低质量页面。`,
      steps: [
        "扩展内容至至少 300 字符（建议 1000+）",
        "围绕核心关键词展开",
        "使用小标题组织内容结构",
        "添加图片、视频等多媒体内容",
        "引用权威来源，添加外部链接",
      ],
      expectedBenefit: "提升页面质量和权威性，获得更多长尾关键词排名",
    },
    
    // 图片
    MISSING_IMG_ALT: {
      code: "MISSING_IMG_ALT",
      title: "添加图片 Alt 文本",
      priority: 2,
      impact: "medium",
      effort: "medium",
      category: "content",
      description: `${finding.currentValue} 张图片缺少 alt 属性。`,
      steps: [
        "为每张图片添加有意义的 alt 文本",
        "alt 应描述图片内容",
        "包含相关关键词（但不要堆砌）",
        "装饰性图片用 alt=\"\"",
      ],
      codeExample: `<img src="image.jpg" alt="描述图片内容的 alt 文本，包含关键词">`,
      expectedBenefit: "图片搜索收录，在图片搜索中获得流量",
    },
    
    // 性能
    SLOW_TTFB: {
      code: "SLOW_TTFB",
      title: "优化 TTFB（首字节时间）",
      priority: 2,
      impact: "high",
      effort: "high",
      category: "performance",
      description: `TTFB ${finding.currentValue}ms 过慢，影响用户体验和 SEO。`,
      steps: [
        "检查服务器响应时间",
        "启用服务器端缓存",
        "使用 CDN 加速",
        "优化数据库查询",
        "考虑升级服务器配置",
      ],
      expectedBenefit: "提升 Core Web Vitals 指标，改善用户体验",
    },
    SLOW_FCP: {
      code: "SLOW_FCP",
      title: "优化 FCP（首次内容绘制）",
      priority: 2,
      impact: "high",
      effort: "medium",
      category: "performance",
      description: `FCP ${finding.currentValue}ms 较慢。`,
      steps: [
        "减少阻塞渲染的 JS 和 CSS",
        "内联关键 CSS",
        "延迟加载非关键资源",
        "启用浏览器缓存",
      ],
      codeExample: `<link rel="preload" href="critical.css" as="style">`,
      expectedBenefit: "提升页面加载速度，降低跳出率",
    },
    SLOW_LCP: {
      code: "SLOW_LCP",
      title: "优化 LCP（最大内容绘制）",
      priority: 1,
      impact: "high",
      effort: "medium",
      category: "performance",
      description: `LCP ${finding.currentValue}ms 较慢，影响 Core Web Vitals。`,
      steps: [
        "优化 LCP 图片：压缩、WebP 格式",
        "预加载 LCP 图片",
        "使用 CDN",
        "移除不必要的图片",
        "优化图片尺寸",
      ],
      codeExample: `<link rel="preload" as="image" href="lcp-image.jpg">`,
      expectedBenefit: "显著提升 Core Web Vitals，改善搜索排名",
    },
    HIGH_TBT: {
      code: "HIGH_TBT",
      title: "降低 TBT（总阻塞时间）",
      priority: 2,
      impact: "medium",
      effort: "medium",
      category: "performance",
      description: `TBT ${finding.currentValue}ms 过高。`,
      steps: [
        "拆分长任务 JavaScript",
        "推迟加载非关键 JS",
        "使用 Web Worker 处理耗时任务",
        "优化第三方脚本",
      ],
      expectedBenefit: "改善交互响应速度，提升用户体验",
    },
    
    // Schema
    MISSING_SCHEMA: {
      code: "MISSING_SCHEMA",
      title: "添加结构化数据",
      priority: 2,
      impact: "medium",
      effort: "medium",
      category: "technical",
      description: "缺少 JSON-LD 结构化数据，错失富媒体搜索结果。",
      steps: [
        `根据页面类型选择合适的 Schema 类型`,
        "文章页用 Article 或 BlogPosting",
        "产品页用 Product",
        "FAQ 用 FAQPage",
        "使用 Google 结构化数据测试工具验证",
      ],
      codeExample: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "文章标题",
  "author": { "@type": "Person", "name": "作者名" },
  "datePublished": "2024-01-01"
}
</script>`,
      references: [
        "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
      ],
      expectedBenefit: "获得富媒体搜索结果展示，提升点击率",
    },
    
    // Open Graph
    MISSING_OG: {
      code: "MISSING_OG",
      title: "添加 Open Graph 标签",
      priority: 3,
      impact: "medium",
      effort: "low",
      category: "technical",
      description: "缺少 Open Graph 标签，影响社交分享效果。",
      steps: [
        "添加 og:title, og:description, og:image",
        "og:image 建议 1200x630 像素",
        "确保分享时展示正确信息",
      ],
      codeExample: `<meta property="og:title" content="分享标题">
<meta property="og:description" content="分享描述">
<meta property="og:image" content="https://example.com/image.jpg">
<meta property="og:url" content="https://example.com/page">
<meta property="og:type" content="website">`,
      expectedBenefit: "社交分享更美观，提升社交媒体引流",
    },
    
    // Links
    NO_INTERNAL_LINKS: {
      code: "NO_INTERNAL_LINKS",
      title: "添加内部链接",
      priority: 2,
      impact: "medium",
      effort: "medium",
      category: "links",
      description: "页面缺少内部链接，影响网站结构传递。",
      steps: [
        "在内容中添加指向相关页面的链接",
        "使用描述性锚文本",
        "链接到网站重要页面",
        "控制单页内链数量（建议 3-10 个）",
      ],
      codeExample: `<a href="/related-page" title="相关页面描述">相关页面</a>`,
      expectedBenefit: "提升网站整体 SEO，帮助搜索引擎爬取更多页面",
    },
    
    // Canoncial
    MISSING_CANONICAL: {
      code: "MISSING_CANONICAL",
      title: "添加 Canonical 标签",
      priority: 2,
      impact: "high",
      effort: "low",
      category: "technical",
      description: "缺少 canonical 标签，可能导致重复内容问题。",
      steps: [
        "在 <head> 中添加 canonical 指向规范 URL",
        "确保 canonical 指向首选域名（带/不带 www）",
        "动态页面务必添加",
      ],
      codeExample: `<link rel="canonical" href="https://example.com/canonical-url">`,
      expectedBenefit: "集中页面权重，避免重复内容惩罚",
    },
    
    // Robots
    MISSING_ROBOTS: {
      code: "MISSING_ROBOTS",
      title: "配置 Robots Meta",
      priority: 2,
      impact: "medium",
      effort: "low",
      category: "technical",
      description: "缺少 robots meta 或 noindex 可能影响爬取。",
      steps: [
        "大多数页面应被索引：<meta name=\"robots\" content=\"index, follow\">",
        "登录页等无需索引的页面添加：<meta name=\"robots\" content=\"noindex\">",
      ],
      codeExample: `<meta name="robots" content="index, follow">`,
      expectedBenefit: "控制页面索引，提升爬取效率",
    },
  };
  
  return recs[code] || null;
}

// 从任务页面创建优化任务
export async function createOptimizationTasks(
  projectId: string,
  pageUrl: string,
  findings: Finding[]
): Promise<Array<{
  title: string;
  description: string;
  priority: number;
  url: string;
  sourceType: string;
  sourceId: string;
}>> {
  const tasks: Array<{
    title: string;
    description: string;
    priority: number;
    url: string;
    sourceType: string;
    sourceId: string;
  }> = [];
  
  // 优先级映射：severity -> task priority
  const priorityMap: Record<string, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };
  
  for (const finding of findings) {
    const rec = getRecommendationForCode(finding.code, finding, { url: pageUrl, findings });
    if (rec) {
      tasks.push({
        title: rec.title,
        description: `${rec.description}\n\n具体步骤：\n${rec.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${rec.codeExample ? `\n\n代码示例：\n${rec.codeExample}` : ""}`,
        priority: priorityMap[finding.severity] || 3,
        url: pageUrl,
        sourceType: "SEO_AUDIT",
        sourceId: finding.code,
      });
    }
  }
  
  return tasks;
}

export { generateRecommendations };
