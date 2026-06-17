// 内容优化分析器。
// 详细说明见 dev doc v1.2 12 节。
// 输入：URL 或正文 + 目标关键词 + 目标 GEO 问题 + 目标品牌
// 输出：SEO 建议 + GEO 建议 + 可引用片段 + 任务建议

import * as cheerio from "cheerio";
import { crawlPage } from "@/lib/crawler";
import { analyzeSeo, type Finding, type SeoAnalysisResult } from "@/lib/seo/analyzer";
import { getLLMProvider } from "@/lib/llm";

export interface ContentAnalysisInput {
  // 二选一
  url?: string;
  content?: string;     // 纯文本或 HTML
  contentFormat?: "html" | "text";

  // 上下文
  projectId: string;
  targetKeywords: string[];        // 目标 SEO 关键词
  geoQuestionIds?: string[];        // 关联 GEO 问题（可选）
  brandName: string;                // 主品牌
  brandDescription?: string;
}

export interface SeoSuggestion {
  titleSuggestions: string[];
  descriptionSuggestions: string[];
  headingSuggestions: string[];
  keywordGaps: string[];            // 缺失的关键词
  internalLinkSuggestions: string[];
  schemaSuggestions: string[];
  improvements: string[];          // 通用改进
}

export interface GeoSuggestion {
  definitionParagraph: string;        // 建议加的定义段
  faqSuggestions: Array<{ question: string; answer: string }>;
  comparisonTable: string;          // 建议加的对比表（Markdown）
  citableSnippets: string[];        // 现文中可作为 AI 引用的段落
  brandMentionsToAdd: string[];     // 需补充的品牌提及
  missedOpportunities: string[];
  improvements: string[];
}

export interface TaskSuggestion {
  title: string;
  description: string;
  priority: 1 | 2 | 3;             // 1 = 最高
  source: "SEO" | "GEO";
}

export interface ContentAnalysisResult {
  url?: string;
  title?: string;
  description?: string;
  wordCount: number;
  seoResult?: SeoAnalysisResult;     // 仅 URL 模式有
  findings: Finding[];              // SEO findings（合并 URL 抓取的 + LLM 识别）
  seoSuggestions: SeoSuggestion;
  geoSuggestions: GeoSuggestion;
  taskSuggestions: TaskSuggestion[];
  llmRaw?: string;                  // 调试用
}

const GENERATION_PROMPT = `你是一个 GEO + SEO 内容优化专家。
请分析下面的网页内容，并基于提供的「目标关键词」和「GEO 问题」给出优化建议。

主品牌：{brandName}
品牌描述：{brandDescription}

目标关键词：{targetKeywords}

GEO 问题：
{geoQuestions}

当前页面：
标题：{title}
Meta description：{description}
正文摘要（前 2000 字符）：
{content}

请输出 JSON（直接输出合法 JSON，不要 markdown 标记）：
{{
  "titleSuggestions": ["建议 1", "建议 2"],
  "descriptionSuggestions": ["建议 1", "建议 2"],
  "headingSuggestions": ["建议 H2 主题 1", "建议 H2 主题 2"],
  "keywordGaps": ["缺失但应该加的关键词"],
  "internalLinkSuggestions": ["建议加的内链到：xxx", ...],
  "schemaSuggestions": ["建议加 FAQPage schema", "建议加 Article schema", ...],
  "improvements": ["SEO 通用改进建议 1", ...],

  "definitionParagraph": "建议加在页首的定义段落（50-100 字）",
  "faqSuggestions": [
    {{"question": "...", "answer": "..."}}
  ],
  "comparisonTable": "Markdown 格式的对比表（建议加的）",
  "citableSnippets": ["现文中可以直接被 AI 引用的段落（按原样抄出来）"],
  "brandMentionsToAdd": ["建议补充的品牌相关事实点"],
  "missedOpportunities": ["GEO 优化点"],
  "improvements_geo": ["GEO 通用改进建议"],

  "taskSuggestions": [
    {{
      "title": "具体可执行任务标题",
      "description": "详细说明",
      "priority": 1,
      "source": "SEO"
    }}
  ]
}}`;

interface LLMOutput {
  titleSuggestions: string[];
  descriptionSuggestions: string[];
  headingSuggestions: string[];
  keywordGaps: string[];
  internalLinkSuggestions: string[];
  schemaSuggestions: string[];
  improvements: string[];

  definitionParagraph: string;
  faqSuggestions: Array<{ question: string; answer: string }>;
  comparisonTable: string;
  citableSnippets: string[];
  brandMentionsToAdd: string[];
  missedOpportunities: string[];
  improvements_geo: string[];

  taskSuggestions: Array<{
    title: string;
    description: string;
    priority: number;
    source: string;
  }>;
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

export async function analyzeContent(input: ContentAnalysisInput): Promise<ContentAnalysisResult> {
  let url: string | undefined;
  let html: string | undefined;
  let text: string | undefined;
  let title: string | undefined;
  let description: string | undefined;
  let seoResult: SeoAnalysisResult | undefined;

  if (input.url) {
    url = input.url;
    const crawl = await crawlPage(input.url);
    html = crawl.html;
    text = stripHtml(html);
    const $ = cheerio.load(html);
    title = $("title").first().text().trim() || undefined;
    description = $('meta[name="description"]').attr("content")?.trim() || undefined;

    seoResult = analyzeSeo({
      url: crawl.url,
      finalUrl: crawl.finalUrl,
      statusCode: crawl.statusCode,
      html: crawl.html,
      performance: crawl.performance,
    });
  } else if (input.content) {
    if (input.contentFormat === "html") {
      html = input.content;
      text = stripHtml(html);
      const $ = cheerio.load(html);
      title = $("title").first().text().trim() || undefined;
      description = $('meta[name="description"]').attr("content")?.trim() || undefined;
    } else {
      text = input.content;
    }
  } else {
    throw new Error("必须提供 url 或 content 之一");
  }

  // 加载 GEO 问题
  let geoQuestions: Array<{ id: string; question: string }> = [];
  if (input.geoQuestionIds && input.geoQuestionIds.length > 0) {
    const { prisma } = await import("@/lib/db");
    geoQuestions = await prisma.geoQuestion.findMany({
      where: { id: { in: input.geoQuestionIds } },
      select: { id: true, question: true },
    });
  }

  // 调 LLM 生成建议
  const llm = getLLMProvider();
  const prompt = GENERATION_PROMPT
    .replace("{brandName}", input.brandName)
    .replace("{brandDescription}", input.brandDescription ?? "")
    .replace("{targetKeywords}", input.targetKeywords.join(", "))
    .replace("{geoQuestions}", geoQuestions.map((q) => q.question).join("\n") || "（无）")
    .replace("{title}", title ?? "（无）")
    .replace("{description}", description ?? "（无）")
    .replace("{content}", (text ?? "").slice(0, 2000));

  const llmText = await llm.complete({
    system: "你只输出合法 JSON，不要包含任何额外文字。",
    prompt,
    responseFormat: "json",
    temperature: 0.4,
    maxTokens: 4000,
  });

  let llmOut: LLMOutput;
  try {
    llmOut = JSON.parse(llmText);
  } catch {
    const match = llmText.match(/\{[\s\S]*\}/);
    if (match) {
      llmOut = JSON.parse(match[0]);
    } else {
      throw new Error(`LLM returned invalid JSON: ${llmText.slice(0, 200)}`);
    }
  }

  return {
    url,
    title,
    description,
    wordCount: (text ?? "").length,
    seoResult,
    findings: seoResult?.findings ?? [],
    seoSuggestions: {
      titleSuggestions: llmOut.titleSuggestions ?? [],
      descriptionSuggestions: llmOut.descriptionSuggestions ?? [],
      headingSuggestions: llmOut.headingSuggestions ?? [],
      keywordGaps: llmOut.keywordGaps ?? [],
      internalLinkSuggestions: llmOut.internalLinkSuggestions ?? [],
      schemaSuggestions: llmOut.schemaSuggestions ?? [],
      improvements: llmOut.improvements ?? [],
    },
    geoSuggestions: {
      definitionParagraph: llmOut.definitionParagraph ?? "",
      faqSuggestions: llmOut.faqSuggestions ?? [],
      comparisonTable: llmOut.comparisonTable ?? "",
      citableSnippets: llmOut.citableSnippets ?? [],
      brandMentionsToAdd: llmOut.brandMentionsToAdd ?? [],
      missedOpportunities: llmOut.missedOpportunities ?? [],
      improvements: llmOut.improvements_geo ?? [],
    },
    taskSuggestions: (llmOut.taskSuggestions ?? []).map((t) => ({
      title: t.title,
      description: t.description,
      priority: (t.priority >= 1 && t.priority <= 5 ? t.priority : 3) as 1 | 2 | 3,
      source: (t.source === "GEO" ? "GEO" : "SEO") as "SEO" | "GEO",
    })),
    llmRaw: llmText,
  };
}
