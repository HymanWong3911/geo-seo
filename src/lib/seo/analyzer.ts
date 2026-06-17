// SEO 分析器。
// 详细说明见 dev doc v1.2 10 节 + 7.1 节。
// 输入：抓取后的 HTML + 渲染 DOM + 响应元数据 + 性能数据
// 输出：score + findings + snapshot

import * as cheerio from "cheerio";

export interface Finding {
  code: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
  currentValue?: string | number | null;
  expectedValue?: string | number | null;
}

export interface PerformanceData {
  ttfb: number;
  fcp: number | null;
  lcp: number | null;
  tbt: number;
}

export interface SeoAnalysisInput {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  performance: PerformanceData;
}

export interface SeoAnalysisResult {
  score: number;
  indexable: boolean;
  findings: Finding[];
  snapshot: {
    title?: string;
    description?: string;
    h1?: string;
    wordCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    imageCount: number;
    imageWithAltCount: number;
    hasCanonical: boolean;
    hasSchema: boolean;
    hasOpenGraph: boolean;
    performance: PerformanceData;
  };
}

// ============= 子分析器 =============

function analyzeTitle($: cheerio.CheerioAPI): Finding[] {
  const findings: Finding[] = [];
  const title = $("title").first().text().trim();
  if (!title) {
    findings.push({
      code: "MISSING_TITLE",
      severity: "high",
      title: "缺少 title",
      description: "页面没有设置 title 标签，搜索引擎无法有效理解页面主题。",
      recommendation: "在 <head> 中添加 <title>，包含核心关键词，20-60 字符最佳。",
    });
  } else if (title.length < 20) {
    findings.push({
      code: "TITLE_TOO_SHORT",
      severity: "medium",
      title: "title 过短",
      description: `title 只有 ${title.length} 字符，搜索结果摘要可能不丰富。`,
      recommendation: "扩展 title 至 20-60 字符，包含核心关键词。",
      currentValue: title.length,
      expectedValue: "20-60",
    });
  } else if (title.length > 60) {
    findings.push({
      code: "TITLE_TOO_LONG",
      severity: "medium",
      title: "title 过长",
      description: `title 有 ${title.length} 字符，可能在搜索结果中被截断。`,
      recommendation: "精简 title 至 60 字符以内，核心内容放最前。",
      currentValue: title.length,
      expectedValue: "≤ 60",
    });
  }
  return findings;
}

function analyzeDescription($: cheerio.CheerioAPI): Finding[] {
  const findings: Finding[] = [];
  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!desc) {
    findings.push({
      code: "MISSING_META_DESCRIPTION",
      severity: "high",
      title: "缺少 meta description",
      description: "页面没有设置 meta description，搜索结果摘要可能不可控。",
      recommendation: "添加 meta description，80-160 字符，包含核心关键词和页面价值。",
    });
  } else if (desc.length < 80) {
    findings.push({
      code: "META_DESCRIPTION_TOO_SHORT",
      severity: "medium",
      title: "meta description 过短",
      description: `meta description 只有 ${desc.length} 字符。`,
      recommendation: "扩展至 80-160 字符。",
      currentValue: desc.length,
    });
  } else if (desc.length > 160) {
    findings.push({
      code: "META_DESCRIPTION_TOO_LONG",
      severity: "medium",
      title: "meta description 过长",
      description: `meta description 有 ${desc.length} 字符，可能被截断。`,
      recommendation: "精简至 160 字符以内。",
      currentValue: desc.length,
    });
  }
  return findings;
}

function analyzeHeadings($: cheerio.CheerioAPI): Finding[] {
  const findings: Finding[] = [];
  const h1s = $("h1");
  if (h1s.length === 0) {
    findings.push({
      code: "MISSING_H1",
      severity: "high",
      title: "缺少 H1",
      description: "页面没有 H1 标签，搜索引擎难以判断页面主标题。",
      recommendation: "每个页面应有且仅有一个 H1。",
    });
  } else if (h1s.length > 1) {
    findings.push({
      code: "MULTIPLE_H1",
      severity: "medium",
      title: "多个 H1",
      description: `页面有 ${h1s.length} 个 H1，可能稀释页面主题。`,
      recommendation: "保留一个 H1，其余改为 H2/H3。",
      currentValue: h1s.length,
    });
  }
  return findings;
}

function analyzeCanonical($: cheerio.CheerioAPI): Finding[] {
  const findings: Finding[] = [];
  const canonical = $('link[rel="canonical"]').attr("href");
  if (!canonical) {
    findings.push({
      code: "MISSING_CANONICAL",
      severity: "medium",
      title: "缺少 canonical",
      description: "页面没有 canonical 链接，可能产生重复内容问题。",
      recommendation: '添加 <link rel="canonical" href="..."> 指向规范 URL。',
    });
  }
  return findings;
}

function analyzeIndexability(
  $: cheerio.CheerioAPI,
  input: SeoAnalysisInput,
): { findings: Finding[]; indexable: boolean } {
  const findings: Finding[] = [];
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  const xRobots = $('meta[http-equiv="X-Robots-Tag"]').attr("content")?.toLowerCase() ?? "";
  const combined = `${robotsMeta} ${xRobots}`;

  let indexable = true;
  if (combined.includes("noindex")) {
    indexable = false;
    findings.push({
      code: "NON_INDEXABLE",
      severity: "high",
      title: "页面被标记为不可索引",
      description: `页面包含 noindex 指令：${combined.trim()}`,
      recommendation: "如需被搜索引擎收录，移除 noindex 指令。",
    });
  }
  if (input.statusCode >= 400) {
    indexable = false;
    findings.push({
      code: "NON_INDEXABLE",
      severity: "high",
      title: `HTTP ${input.statusCode} 错误`,
      description: "页面返回错误状态码，无法被索引。",
      recommendation: "修复服务端问题，确保返回 2xx。",
      currentValue: input.statusCode,
    });
  }
  return { findings, indexable };
}

function analyzeImages($: cheerio.CheerioAPI): { findings: Finding[]; imageCount: number; imageWithAltCount: number } {
  const findings: Finding[] = [];
  const images = $("img");
  const imageCount = images.length;
  let imageWithAltCount = 0;
  const missingAlt: string[] = [];

  images.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt !== undefined && alt.trim() !== "") {
      imageWithAltCount++;
    } else {
      const src = $(el).attr("src") ?? "(无 src)";
      missingAlt.push(src.length > 50 ? src.slice(0, 50) + "..." : src);
    }
  });

  if (missingAlt.length > 0) {
    findings.push({
      code: "IMAGE_MISSING_ALT",
      severity: "medium",
      title: `${missingAlt.length} 张图片缺少 alt`,
      description: "图片 alt 属性是搜索引擎理解图片内容的重要依据。",
      recommendation: "为每张 <img> 添加描述性 alt 文本。",
      currentValue: missingAlt.length,
      expectedValue: 0,
    });
  }
  return { findings, imageCount, imageWithAltCount };
}

function analyzeLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): { findings: Finding[]; internal: number; external: number } {
  const findings: Finding[] = [];
  let internal = 0;
  let external = 0;
  let noInternal = true;

  try {
    const base = new URL(baseUrl);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
        return;
      }
      try {
        const url = new URL(href, baseUrl);
        if (url.hostname === base.hostname) {
          internal++;
          noInternal = false;
        } else {
          external++;
        }
      } catch {
        // 忽略无法解析的 URL
      }
    });
  } catch {
    // baseUrl 解析失败
  }

  if (noInternal) {
    findings.push({
      code: "NO_INTERNAL_LINKS",
      severity: "medium",
      title: "缺少内链",
      description: "页面没有任何指向本站其他页面的链接。",
      recommendation: "在正文中加入相关内链，帮助搜索引擎理解网站结构。",
    });
  }

  return { findings, internal, external };
}

function analyzeSchema($: cheerio.CheerioAPI): { findings: Finding[]; hasSchema: boolean } {
  const findings: Finding[] = [];
  const scripts = $('script[type="application/ld+json"]');
  const hasSchema = scripts.length > 0;

  if (!hasSchema) {
    findings.push({
      code: "MISSING_SCHEMA",
      severity: "low",
      title: "缺少 Schema.org 结构化数据",
      description: "页面没有 JSON-LD 结构化数据，可能在搜索结果中错失富媒体展示。",
      recommendation: "根据页面类型添加 Article / Product / FAQPage 等 Schema。",
    });
  }
  return { findings, hasSchema };
}

function analyzeOpenGraph($: cheerio.CheerioAPI): { findings: Finding[]; hasOpenGraph: boolean } {
  const findings: Finding[] = [];
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDescription = $('meta[property="og:description"]').attr("content");
  const hasOpenGraph = !!(ogTitle && ogImage && ogDescription);

  if (!hasOpenGraph) {
    findings.push({
      code: "MISSING_OG",
      severity: "low",
      title: "缺少 Open Graph",
      description: "页面缺少 og:title / og:image / og:description，分享到社交平台时效果差。",
      recommendation: "添加完整的 Open Graph meta 标签。",
    });
  }
  return { findings, hasOpenGraph };
}

function analyzeContent($: cheerio.CheerioAPI): { findings: Finding[]; wordCount: number } {
  const findings: Finding[] = [];
  // 提取正文（移除 script / style / nav / footer）
  const clone = $.root().clone();
  clone.find("script, style, nav, footer, header, aside, noscript").remove();
  const text = clone.text().replace(/\s+/g, " ").trim();
  const wordCount = text.length;  // 中英文都按字符数算

  if (wordCount < 300) {
    findings.push({
      code: "LOW_WORD_COUNT",
      severity: "medium",
      title: "页面字数过少",
      description: `正文只有 ${wordCount} 字符。`,
      recommendation: "扩展内容至至少 300 字符，覆盖核心搜索意图。",
      currentValue: wordCount,
      expectedValue: "≥ 300",
    });
  }
  return { findings, wordCount };
}

function analyzePerformance(p: PerformanceData): Finding[] {
  const findings: Finding[] = [];
  if (p.ttfb > 800) {
    findings.push({
      code: "SLOW_TTFB",
      severity: "medium",
      title: "TTFB 慢",
      description: `首字节时间 ${Math.round(p.ttfb)}ms。`,
      recommendation: "检查服务器响应时间、CDN 配置、数据库查询。",
      currentValue: Math.round(p.ttfb),
      expectedValue: "≤ 800ms",
    });
  }
  if (p.fcp !== null && p.fcp > 1800) {
    findings.push({
      code: "SLOW_FCP",
      severity: "medium",
      title: "FCP 慢",
      description: `首次内容绘制 ${Math.round(p.fcp)}ms。`,
      recommendation: "减少阻塞资源、内联关键 CSS、预连接到第三方。",
      currentValue: Math.round(p.fcp),
      expectedValue: "≤ 1800ms",
    });
  }
  if (p.lcp !== null && p.lcp > 2500) {
    findings.push({
      code: "SLOW_LCP",
      severity: "high",
      title: "LCP 慢",
      description: `最大内容绘制 ${Math.round(p.lcp)}ms。`,
      recommendation: "优化最大元素（通常是图片）：压缩、预加载、CDN。",
      currentValue: Math.round(p.lcp),
      expectedValue: "≤ 2500ms",
    });
  }
  if (p.tbt > 200) {
    findings.push({
      code: "HIGH_TBT",
      severity: "medium",
      title: "TBT 高",
      description: `总阻塞时间 ${Math.round(p.tbt)}ms。`,
      recommendation: "拆分长任务、推迟非关键 JS、Web Worker 化。",
      currentValue: Math.round(p.tbt),
      expectedValue: "≤ 200ms",
    });
  }
  return findings;
}

// ============= 评分 =============
// 满分 100，扣分制。

const SEVERITY_PENALTY = {
  high: 20,
  medium: 10,
  low: 3,
};

function calculateScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    penalty += SEVERITY_PENALTY[f.severity];
  }
  return Math.max(0, 100 - penalty);
}

// ============= 主入口 =============

export function analyzeSeo(input: SeoAnalysisInput): SeoAnalysisResult {
  const $ = cheerio.load(input.html);

  const title = $("title").first().text().trim() || undefined;
  const description = $('meta[name="description"]').attr("content")?.trim() || undefined;
  const h1 = $("h1").first().text().trim() || undefined;

  const findings: Finding[] = [];
  findings.push(...analyzeTitle($));
  findings.push(...analyzeDescription($));
  findings.push(...analyzeHeadings($));
  findings.push(...analyzeCanonical($));
  const { findings: idxF, indexable } = analyzeIndexability($, input);
  findings.push(...idxF);

  const { findings: imgF, imageCount, imageWithAltCount } = analyzeImages($);
  findings.push(...imgF);

  const { findings: linkF, internal, external } = analyzeLinks($, input.finalUrl);
  findings.push(...linkF);

  const { findings: schemaF, hasSchema } = analyzeSchema($);
  findings.push(...schemaF);

  const { findings: ogF, hasOpenGraph } = analyzeOpenGraph($);
  findings.push(...ogF);

  const { findings: contentF, wordCount } = analyzeContent($);
  findings.push(...contentF);

  findings.push(...analyzePerformance(input.performance));

  const score = calculateScore(findings);

  return {
    score,
    indexable,
    findings,
    snapshot: {
      title,
      description,
      h1,
      wordCount,
      internalLinkCount: internal,
      externalLinkCount: external,
      imageCount,
      imageWithAltCount,
      hasCanonical: !!$('link[rel="canonical"]').attr("href"),
      hasSchema,
      hasOpenGraph,
      performance: input.performance,
    },
  };
}
