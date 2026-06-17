// OpenAI 官方 API 实现。
// 详细说明见 dev doc v1.2 4.6 节。
import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements LLMProvider {
  name = "openai";

  estimateCost(input: LLMCompleteInput): number {
    // 简化估算：gpt-4.1 输入 $2.50/1M，输出 $10/1M
    // 这里返回 cents，需要根据实际模型调整
    const promptChars = (input.system?.length ?? 0) + input.prompt.length;
    const completionChars = input.maxTokens ?? 2000;
    const promptCost = (promptChars / 4 / 1000) * 0.25; // 约 1 token / 4 字符
    const completionCost = (completionChars / 4 / 1000) * 1.0;
    return Math.round((promptCost + completionCost) * 100);
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

    const res = await fetch(process.env.OPENAI_BASE_URL ?? ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt }],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2000,
        ...(input.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    return {
      content: json.choices[0]?.message.content ?? "",
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}
