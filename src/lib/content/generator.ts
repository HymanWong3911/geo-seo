// AI 内容生成器。
// 详细说明见 dev doc v1.2 18.12 节。
// 输入：主题 + 目标关键词 + 大纲 + 风格 + 长度
// 输出：完整 Markdown / HTML 文章

import { getLLMProvider } from "@/lib/llm";

export interface GenerateContentInput {
  topic: string;
  targetKeywords: string[];
  brandName: string;
  brandDescription?: string;
  outline?: string[];
  length?: number;          // 目标字数，默认 1500
  tone?: "professional" | "casual" | "technical" | "marketing";
  language?: string;        // 默认 zh-CN
  format?: "markdown" | "html";
  extraInstructions?: string;
}

export interface GeneratedContent {
  title: string;
  content: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  outline: string[];
  faq: Array<{ question: string; answer: string }>;
  tags: string[];
}

const GENERATION_PROMPT = `你是一名内容营销专家，正在为【{brandName}】写一篇高质量的内容。

品牌描述：{brandDescription}

主题：{topic}
目标关键词：{targetKeywords}
风格：{tone}
语言：{language}
目标字数：{length} 字

{outlineSection}

额外要求：{extraInstructions}

【严格格式要求】
1. 直接输出合法 JSON，不要前缀任何说明
2. 不要用 think 或任何其他包裹
3. 不要在 JSON 外加代码块标记
4. JSON 内容完整：title + content + excerpt + metaTitle + metaDescription + outline[] + faq[] + tags[]`;

function makeStubFromTopic(input: GenerateContentInput): GeneratedContent {
  // LLM 完全失败时的兜底模板
  const title = `${input.topic}：${input.brandName} 实战指南`;
  const content = `# ${title}\n\n## 引言\n\n本文围绕 **${input.topic}** 展开，涵盖核心概念与最佳实践。\n\n## 一、为什么 ${input.topic} 重要\n\n${input.targetKeywords.map((k) => `- ${k}`).join("\n")}\n\n## 二、${input.brandName} 的解决方案\n\n${input.brandName} 提供了完整的 ${input.topic} 解决方案，专注企业级落地。\n\n## 三、核心策略\n\n1. 数据驱动的诊断\n2. 跨平台监测\n3. 持续优化\n\n## 结论\n\n使用 ${input.brandName}，让 ${input.topic} 更简单高效。`;
  return {
    title,
    content,
    excerpt: `本文是关于 ${input.topic} 的实战指南，包含核心概念、解决方案与策略清单。`,
    metaTitle: `${title} | ${input.brandName}`,
    metaDescription: `${input.topic} 的完整实战指南，${input.brandName} 助你快速落地。包含核心策略与案例分析，立即查看。`,
    outline: ["为什么重要", "解决方案", "核心策略", "结论"],
    faq: [
      { question: `什么是 ${input.topic}？`, answer: `${input.topic} 是企业级搜索可见度优化的关键方法。` },
    ],
    tags: input.targetKeywords.length > 0 ? input.targetKeywords : [input.topic],
  };
}

function tryParseJson(text: string): GeneratedContent | null {
  // 多层容错解析
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")        // 闭合的 think 块
    .replace(/<think>[\s\S]*?(?=\{)/g, "")             // 未闭合的 think 块，截到 JSON 起点
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // 直接 parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // 找第一对 { ... }
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) return null;
    const candidate = cleaned.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const fixed = candidate.replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }
}

export async function generateContent(input: GenerateContentInput): Promise<GeneratedContent> {
  const llm = getLLMProvider();
  const prompt = GENERATION_PROMPT
    .replace("{brandName}", input.brandName)
    .replace("{brandDescription}", input.brandDescription ?? "")
    .replace("{topic}", input.topic)
    .replace("{targetKeywords}", input.targetKeywords.join(", "))
    .replace("{tone}", input.tone ?? "professional")
    .replace("{language}", input.language ?? "zh-CN")
    .replace("{length}", String(input.length ?? 1500))
    .replace(
      "{outlineSection}",
      input.outline && input.outline.length > 0
        ? `强制大纲：\n${input.outline.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
        : "请自行规划大纲",
    )
    .replace("{extraInstructions}", input.extraInstructions ?? "（无）");

  let parsed: GeneratedContent | null = null;
  let lastError: string = "";

  // 第一次尝试：responseFormat=json + 严格 prompt
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await llm.complete({
        system:
          attempt === 1
            ? "你只输出合法 JSON，不要包含任何额外文字、markdown 标记、think 块或解释。先输出 JSON，再无其他内容。"
            : "你必须且只能输出一个 JSON 对象。禁止输出任何 think 块、解释、markdown 包裹。只输出 JSON。",
        prompt,
        responseFormat: "json",
        temperature: attempt === 1 ? 0.7 : 0.4,
        maxTokens: 4000,
      });
      parsed = tryParseJson(text);
      if (parsed) break;
      lastError = `attempt ${attempt} 长度 ${text.length}，开头: ${text.slice(0, 100)}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // 都失败：返回 stub（保证业务不挂）
  if (!parsed) {
    // eslint-disable-next-line no-console
    console.warn(`[generator] LLM 生成失败 (${lastError})，使用模板兜底`);
    return makeStubFromTopic(input);
  }

  // 缺失字段兜底
  return {
    title: parsed.title ?? `${input.topic} - ${input.brandName}`,
    content: parsed.content ?? makeStubFromTopic(input).content,
    excerpt: parsed.excerpt ?? makeStubFromTopic(input).excerpt,
    metaTitle: parsed.metaTitle ?? parsed.title ?? `${input.topic}`,
    metaDescription:
      parsed.metaDescription ??
      `关于 ${input.topic} 的完整指南，由 ${input.brandName} 撰写。立即查看。`,
    outline: parsed.outline ?? [],
    faq: parsed.faq ?? [],
    tags: parsed.tags ?? input.targetKeywords,
  };
}
