// Anthropic 官方 API 实现。
// 详细说明见 dev doc v1.2 4.6 节。
import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";

  estimateCost(_input: LLMCompleteInput): number {
    // Claude Sonnet 4 输入 $3/1M，输出 $15/1M
    return 1;
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: input.maxTokens ?? 2000,
        system: input.system ?? "",
        messages: [{ role: "user", content: input.prompt }],
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      content: Array<{ text: string }>;
      usage?: {
        input_tokens: number;
        output_tokens: number;
      };
    };

    return {
      content: json.content[0]?.text ?? "",
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
    };
  }
}
