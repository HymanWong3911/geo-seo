// 阿里云百炼 (DashScope) LLM Provider。
// 详细说明见 dev doc v1.2 4.6 节 + ARK 配额耗尽时(2026-07-23)的临时切换文档。
//
// 协议:走 DashScope OpenAI-compatible mode (`/compatible-mode/v1/chat/completions`),
// 与 OpenAI 的 /chat/completions 协议一致,但 base_url 走 DashScope 域名。
// 鉴权:Bearer <BAILIAN_API_KEY> 或 <DASHSCOPE_API_KEY>。
//
// 触发:getLLMProvider() 在 BAILIAN_API_KEY 或 DASHSCOPE_API_KEY 存在时优先用本 provider,
// GEO_RUN_MOCK_LLM=true 仍优先于百炼。完全配置放在外部 env,不写 .env。

import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

// 2026-07-23: 默认切到「套餐专属 token-plan」端点 — 用户当前的订阅走这条 URL,
// 不再默认指向通用 DashScope。也可通过 BAILIAN_BASE_URL env 在生产切回旧端点。
//
// 默认模型:用户已确认 token-plan 当前可用列表为 qwen3.8-max-preview / qwen3.7-plus /
// qwen3.7-max / qwen3.6-flash / deepseek-v4-pro / glm-5.2 等;「qwen-plus」**不在订阅
// 列表** 会直接 404 model_not_found,所以默认改成有 10x 限时加量的 qwen3.8-max-preview。
const DEFAULT_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3.8-max-preview";

export class BailianProvider implements LLMProvider {
  name = "bailian";

  estimateCost(_input: LLMCompleteInput): number {
    // 占位:百炼 qwen-plus 实际约 0.0008 元 / 1k input,0.002 元 / 1k output。
    // 真实计费用 LLMCall 记账;此处只占位,触发现有成本日志链路。
    return 1;
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    // 2026-07-23: 同时接受 BAILIAN_* 与 GROK_BAILIAN_*(用户在 shell 里注册的别名,后注册到的别名是 GROK_BAILIAN_*)
    const baseUrl = process.env.BAILIAN_BASE_URL
      ?? process.env.GROK_BAILIAN_BASE_URL
      ?? DEFAULT_BASE;
    const apiKey = process.env.BAILIAN_API_KEY
      ?? process.env.DASHSCOPE_API_KEY
      ?? process.env.GROK_BAILIAN_API_KEY
      ?? "";
    const model = process.env.BAILIAN_MODEL
      ?? process.env.GROK_BAILIAN_MODEL
      ?? DEFAULT_MODEL;

    if (!apiKey) {
      throw new Error("Bailian provider: missing BAILIAN_API_KEY / DASHSCOPE_API_KEY / GROK_BAILIAN_API_KEY in env");
    }

    if (!apiKey) {
      throw new Error("Bailian provider: missing BAILIAN_API_KEY or DASHSCOPE_API_KEY in env");
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
      // 2026-07-23: 加 AbortSignal.timeout 防上游慢导致 worker hang,默认 60s
      signal: AbortSignal.timeout(parseInt(process.env.BAILIAN_FETCH_TIMEOUT_MS ?? "60000")),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bailian API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string | null } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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
