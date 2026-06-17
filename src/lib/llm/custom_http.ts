// 自定义 HTTP LLM 端点。
// 适用于自部署 vLLM / Ollama / LM Studio / 内部网关等。
// 协议：OpenAI 兼容（/v1/chat/completions）。
// 详细说明见 dev doc v1.2 4.6 节。

import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

export class CustomHTTPProvider implements LLMProvider {
  name = "custom_http";

  estimateCost(_input: LLMCompleteInput): number {
    return 0; // 自部署不计费
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const baseUrl = process.env.LLM_CUSTOM_HTTP_URL;
    if (!baseUrl) {
      throw new Error("LLM_CUSTOM_HTTP_URL is not set");
    }
    const auth = process.env.LLM_CUSTOM_HTTP_AUTH;
    const model = process.env.LLM_CUSTOM_HTTP_MODEL ?? "default";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (auth) headers["Authorization"] = auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers,
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
      throw new Error(`Custom HTTP error: ${res.status} ${text}`);
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
