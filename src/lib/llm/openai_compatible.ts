// OpenAI 兼容协议实现。
// 用于 DeepSeek / MiniMax / Ollama / vLLM / 国内厂商。
// 详细说明见 dev doc v1.2 4.6 节。
import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

export class OpenAICompatibleProvider implements LLMProvider {
  name = "openai_compatible";

  estimateCost(_input: LLMCompleteInput): number {
    // 简化估算：0.0014 元/1k input，0.0028 元/1k output（DeepSeek 报价）
    return 1; // 占位，实际用 LLM_COST_* 环境变量
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const baseUrl = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
    const apiKey = process.env.LLM_API_KEY ?? "";
    const model = process.env.DEFAULT_LLM_MODEL ?? "deepseek-chat";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt },
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2000,
        ...(input.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI-compatible API error: ${res.status} ${text}`);
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
