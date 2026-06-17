// AI 内容改写器。
// 详细说明见 dev doc v1.2 18.13 节。
// 输入：原内容 + 改写建议（findings）
// 输出：改写后的内容 + diff 段

import { diffWords, type Change } from "diff";
import { getLLMProvider } from "@/lib/llm";
import type { Finding } from "@/lib/seo/analyzer";

export interface RewriteInput {
  originalContent: string;
  title?: string;
  findings: Finding[];                 // SEO findings
  targetKeywords: string[];
  brandName?: string;
  preserveTone?: boolean;              // 默认 true
  language?: string;
}

export interface DiffSegment {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface RewriteResult {
  rewritten: string;
  diff: DiffSegment[];
  appliedFindingCodes: string[];
  newWordCount: number;
  newFindingsEstimate: Finding[];
}

const REWRITE_PROMPT = `你是一名内容优化专家。请基于 SEO 诊断建议改写下面的内容，保留原意但修复问题。

品牌：{brandName}
目标关键词：{targetKeywords}

原内容（{wordCount} 字）：
{original}

需要修复的问题：
{findings}

要求：
1. 保持原意和整体结构
2. 自然地融入目标关键词（不堆砌）
3. 修复列出的问题
4. 保持 {tone} 风格

请输出 JSON（直接输出合法 JSON，不要 markdown 标记）：
{{
  "rewritten": "改写后的完整正文（Markdown 格式）",
  "appliedFindingCodes": ["MISSING_TITLE", "..."]
}}`;

export async function rewriteContent(input: RewriteInput): Promise<RewriteResult> {
  const llm = getLLMProvider();
  const prompt = REWRITE_PROMPT
    .replace("{brandName}", input.brandName ?? "")
    .replace("{targetKeywords}", input.targetKeywords.join(", "))
    .replace("{wordCount}", String(input.originalContent.length))
    .replace("{original}", input.originalContent.slice(0, 6000))
    .replace(
      "{findings}",
      input.findings
        .map((f) => `- [${f.severity.toUpperCase()}] ${f.title}（${f.code}）: ${f.recommendation}`)
        .join("\n"),
    )
    .replace("{tone}", input.preserveTone === false ? "casual" : "professional");

  const text = await llm.complete({
    system: "你只输出合法 JSON。",
    prompt,
    responseFormat: "json",
    temperature: 0.6,
    maxTokens: 4000,
  });

  let out: { rewritten: string; appliedFindingCodes: string[] };
  try {
    out = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) out = JSON.parse(match[0]);
    else throw new Error(`LLM 返回了无效 JSON: ${text.slice(0, 200)}`);
  }

  // 计算 diff
  const changes: Change[] = diffWords(input.originalContent, out.rewritten);
  const diff: DiffSegment[] = changes.map((c) => ({
    type: c.added ? "added" : c.removed ? "removed" : "unchanged",
    text: c.value,
  }));

  return {
    rewritten: out.rewritten,
    diff,
    appliedFindingCodes: out.appliedFindingCodes ?? [],
    newWordCount: out.rewritten.length,
    newFindingsEstimate: [],  // 改写后问题估算需要再跑 SEO analyzer，这里留空
  };
}
