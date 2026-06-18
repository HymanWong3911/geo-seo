// Kimi (Moonshot 月之暗面) API 实现（中文）。
// 详细说明见 dev doc v1.2 4.6 节。
//
// 当前部署：Kimi 通过 ARK Coding Plan 网关调用（订阅版 key 共用）。
// 原始 moonshot.cn 入口保留为备选（设置 KIMI_BASE_URL 覆盖）。
// ARK Coding Plan 不支持 web_search tool，所以这里是纯 LLM 回答（无联网）。
import type { RealSearchProvider, SearchOptions, SearchResult, ProviderDiagnostics } from "./index";
import { trackLLMCallWithUsage } from "@/lib/llm/tracker";
import { getLLMProvider } from "@/lib/llm";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions";
const ARK_MODEL = "kimi-k2.6";
const MOONSHOT_ENDPOINT = "https://api.moonshot.cn/v1/chat/completions";
const MOONSHOT_MODEL = "moonshot-v1-128k";

export class KimiProvider implements RealSearchProvider {
  name = "kimi" as const;

  isAvailable(): boolean {
    return Boolean(process.env.KIMI_API_KEY) || Boolean(process.env.ARK_API_KEY);
  }

  getDiagnostics(): ProviderDiagnostics {
    const missing: string[] = [];
    const hasKimiKey = Boolean(process.env.KIMI_API_KEY);
    const hasArkKey = Boolean(process.env.ARK_API_KEY);

    if (!hasKimiKey && !hasArkKey) {
      missing.push("KIMI_API_KEY or ARK_API_KEY");
    }

    return {
      isConfigured: missing.length === 0,
      isAvailable: this.isAvailable(),
      missingEnvVars: missing,
      lastChecked: new Date(),
    };
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const useArk = !process.env.KIMI_API_KEY && Boolean(process.env.ARK_API_KEY);
    const apiKey = process.env.KIMI_API_KEY || process.env.ARK_API_KEY || "";
    if (!apiKey) throw new Error("KIMI_API_KEY or ARK_API_KEY is required for kimi provider");

    const baseUrl = process.env.KIMI_BASE_URL || (useArk ? ARK_ENDPOINT : MOONSHOT_ENDPOINT);
    const model = process.env.KIMI_MODEL || (useArk ? ARK_MODEL : MOONSHOT_MODEL);
    const start = Date.now();

    // 通过通用 LLM provider 包装来拿到真实 token 计数（仅 ARK 网关有效）
    let answer = "";
    let providerName = useArk ? "ark" : "moonshot";

    if (useArk) {
      // 走标准 LLM provider，便于 token tracking
      const llm = getLLMProvider(); // ARKProvider
      try {
        answer = await trackLLMCallWithUsage(
          {
            jobType: "real-search",
            projectId: options.meta?.projectId ?? null,
            geoRunId: options.meta?.geoRunId ?? null,
            provider: "ark-kimi",
            model: `kimi-via-ark/${model}`,
          },
          llm,
          {
            system: "你是 Kimi，由 Moonshot AI 提供的人工智能助手。擅长中英文对话，提供有帮助的回答。",
            prompt: query,
          },
        );
      } catch (err) {
        throw new Error(`Kimi via ARK failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      // Moonshot 直连：保持原 fetch，估算 token
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "你是 Kimi，由 Moonshot AI 提供的人工智能助手。擅长中英文对话，提供有帮助的回答。" },
            { role: "user", content: query },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Kimi API error: ${res.status} ${text}`);
      }

      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      answer = json.choices[0]?.message.content ?? "";
      providerName = "moonshot";

      // 如果 API 返回了 usage，记账
      if (json.usage) {
        const { prisma } = await import("@/lib/db");
        const durationMs = Date.now() - start;
        const promptTokens = json.usage.prompt_tokens;
        const completionTokens = json.usage.completion_tokens;
        const totalTokens = json.usage.total_tokens;
        const costCents = Math.round(((promptTokens / 1000) * 0.0014 + (completionTokens / 1000) * 0.0028) * 10000) / 10000;
        void prisma.llmCall.create({
          data: {
            projectId: options.meta?.projectId ?? null,
            geoRunId: options.meta?.geoRunId ?? null,
            jobType: "real-search",
            provider: "kimi",
            model,
            promptTokens,
            completionTokens,
            totalTokens,
            costCents,
            durationMs,
            success: true,
          },
        }).catch((e) => console.error("[kimi] usage record failed:", e?.message));
      }
    }

    const truncated = answer.slice(0, options.maxAnswerChars ?? 8000);

    return {
      answer: truncated,
      citations: [], // ARK Coding Plan 无 web_search，无引用
      raw: { model, gateway: providerName, durationMs: Date.now() - start },
      durationMs: Date.now() - start,
    };
  }
}
