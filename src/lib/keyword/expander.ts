// AI 长尾关键词扩展。
// 详细说明见 dev doc v1.2 18.15 节。

import { getLLMProvider } from "@/lib/llm";
import { SearchIntent } from "@prisma/client";

export interface ExpandInput {
  seedKeyword: string;
  brandContext?: string;
  language?: string;
  region?: string;
  maxSuggestions?: number;
}

export interface ExpandedKeyword {
  text: string;
  searchVolume: number | null;        // LLM 估算，不准
  difficulty: number | null;          // 0-100
  intent: SearchIntent;
}

const PROMPT = `你是一名 SEO 关键词研究员。请基于下面的种子关键词扩展出 {max} 个长尾关键词。

种子关键词：{seedKeyword}
品牌上下文：{brandContext}
语言：{language}
地区：{region}

请输出 JSON（直接输出合法 JSON，不要 markdown 标记）：
{{
  "suggestions": [
    {{
      "text": "完整的长尾关键词",
      "searchVolume": 估算月搜索量（数字，可为 null）,
      "difficulty": 0-100 的难度估算,
      "intent": "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL" | "LOCAL" | "COMPARISON"
    }}
  ]
}}`;

export async function expandKeywords(input: ExpandInput): Promise<ExpandedKeyword[]> {
  const llm = getLLMProvider();
  const max = input.maxSuggestions ?? 20;

  const prompt = PROMPT
    .replace("{seedKeyword}", input.seedKeyword)
    .replace("{brandContext}", input.brandContext ?? "")
    .replace("{language}", input.language ?? "zh-CN")
    .replace("{region}", input.region ?? "CN")
    .replace("{max}", String(max));

  const text = await llm.complete({
    system: "你只输出合法 JSON。",
    prompt,
    responseFormat: "json",
    temperature: 0.8,
    maxTokens: 2000,
  });

  try {
    const out = JSON.parse(text);
    return (out.suggestions ?? []) as ExpandedKeyword[];
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const out = JSON.parse(match[0]);
      return (out.suggestions ?? []) as ExpandedKeyword[];
    }
    throw new Error(`LLM 返回了无效 JSON: ${text.slice(0, 200)}`);
  }
}
