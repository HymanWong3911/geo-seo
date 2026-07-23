// 火山方舟 ARK Provider（OpenAI 兼容协议）。
// 文档：https://www.volcengine.com/docs/82379/1263482
import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

export class ARKProvider implements LLMProvider {
  name = "ark";

  estimateCost(_input: LLMCompleteInput): number {
    // ark-code-latest 按 token 计费，估算：0.003 元/1k input，0.009 元/1k output
    return 3; // cents per 1k tokens (approximate)
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    const baseUrl = process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/coding/v3";
    const apiKey = process.env.ARK_API_KEY ?? "";
    const model = process.env.ARK_MODEL ?? "ark-code-latest";

    if (!apiKey) {
      throw new Error("ARK_API_KEY is not set. Configure your ARK API key in .env");
    }

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
          { role: "user", content: input.prompt }],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 2000,
        ...(input.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
      // 2026-07-23: 加 AbortSignal.timeout 防卡死。Node 默认 fetch 无超时,quota
      // 限流或上游慢会无限挂起；失败抛 AbortError,被 ark.ts 包成 ARK API error。
      signal: AbortSignal.timeout(parseInt(process.env.ARK_FETCH_TIMEOUT_MS ?? "60000")),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ARK API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string | null } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: json.choices[0]?.message?.content ?? "",
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
