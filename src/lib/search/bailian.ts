// 阿里云百炼（DashScope）真实 AI 搜索渠道。
// 详细说明见 dev doc v1.2 4.6 节 + GEO 搜索渠道抽象（./index.ts）。
//
// 与 kimi / doubao（走 ARK Coding，无联网）不同：
// 百炼通过原生 DashScope 生成 API 的 `enable_search` + `search_options`
// 返回「真正联网检索」的答案，并带回引用来源（search_info.search_results）。
// 通义千问是真实的头部中文 AI 助手，因此这条渠道量出来的品牌可见度是真信号。
//
// 也可用 OpenAI 兼容端点，但兼容模式拿不全引用来源，故这里用原生端点。
import type {
  RealSearchProvider,
  SearchOptions,
  SearchResult,
  ProviderDiagnostics,
} from "./index";

// 原生 DashScope 文本生成端点（支持 enable_search + 引用来源）
const NATIVE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation";
const DEFAULT_MODEL = "qwen-plus";

// costCents：分（100 cents = 1 元）。百炼 qwen-plus 报价约 0.0008/0.002 元每 1k（可用 env 覆盖）
const COST_INPUT_PER_1K = parseFloat(process.env.BAILIAN_COST_INPUT_PER_1K ?? "0.0008");
const COST_OUTPUT_PER_1K = parseFloat(process.env.BAILIAN_COST_OUTPUT_PER_1K ?? "0.002");

interface DashScopeResponse {
  output?: {
    choices?: Array<{
      finish_reason?: string;
      message?: { role: string; content: string };
    }>;
    text?: string;
    search_info?: {
      search_results?: Array<{
        index?: number;
        title?: string;
        url?: string;
        site_name?: string;
      }>;
    };
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  code?: string;
  message?: string;
  request_id?: string;
}

function getApiKey(): string {
  return process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

export class BailianProvider implements RealSearchProvider {
  name = "bailian" as const;

  isAvailable(): boolean {
    return Boolean(getApiKey());
  }

  getDiagnostics(): ProviderDiagnostics {
    const missing: string[] = [];
    if (!getApiKey()) missing.push("BAILIAN_API_KEY (或 DASHSCOPE_API_KEY)");
    return {
      isConfigured: missing.length === 0,
      isAvailable: this.isAvailable(),
      missingEnvVars: missing,
      lastChecked: new Date(),
    };
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("BAILIAN_API_KEY (或 DASHSCOPE_API_KEY) is required for bailian provider");
    }

    const baseUrl = process.env.BAILIAN_BASE_URL || NATIVE_ENDPOINT;
    const model = process.env.BAILIAN_MODEL || DEFAULT_MODEL;
    const enableSearch = process.env.BAILIAN_ENABLE_SEARCH !== "false"; // 默认开启联网
    const start = Date.now();

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "system",
              content:
                "你是通义千问，由阿里云提供的人工智能助手。请基于联网检索结果，准确、客观地回答用户问题。",
            },
            { role: "user", content: query },
          ],
        },
        parameters: {
          result_format: "message",
          enable_search: enableSearch,
          ...(enableSearch
            ? {
                search_options: {
                  forced_search: true,
                  enable_source: true,
                  enable_citation: true,
                  citation_format: "[<number>]",
                  search_strategy: "standard",
                },
              }
            : {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bailian API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as DashScopeResponse;

    // DashScope 在 200 里也可能带业务错误码
    if (json.code) {
      throw new Error(`Bailian API error: ${json.code} ${json.message ?? ""}`);
    }

    const answer =
      json.output?.choices?.[0]?.message?.content ??
      json.output?.text ??
      "";

    const citations = (json.output?.search_info?.search_results ?? [])
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u));

    const durationMs = Date.now() - start;

    // 记账（真实 token）
    if (json.usage) {
      const promptTokens = json.usage.input_tokens ?? 0;
      const completionTokens = json.usage.output_tokens ?? 0;
      const totalTokens = json.usage.total_tokens ?? promptTokens + completionTokens;
      const costCents =
        Math.round(
          ((promptTokens / 1000) * COST_INPUT_PER_1K +
            (completionTokens / 1000) * COST_OUTPUT_PER_1K) *
            100 *
            10000,
        ) / 10000;
      const { prisma } = await import("@/lib/db");
      void prisma.llmCall
        .create({
          data: {
            projectId: options.meta?.projectId ?? null,
            geoRunId: options.meta?.geoRunId ?? null,
            jobType: "real-search",
            provider: "bailian",
            model,
            promptTokens,
            completionTokens,
            totalTokens,
            costCents,
            durationMs,
            success: true,
          },
        })
        .catch((e) => console.error("[bailian] usage record failed:", e?.message));
    }

    const truncated = answer.slice(0, options.maxAnswerChars ?? 8000);

    return {
      answer: truncated,
      citations,
      raw: { model, gateway: "dashscope-native", enableSearch, durationMs },
      durationMs,
    };
  }
}
