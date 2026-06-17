// 豆包（字节跳动火山引擎）实现。
// 详细说明见 dev doc v1.2 4.6 节。
//
// 当前部署：豆包通过 ARK Coding Plan 网关调用（订阅版 key 共用）。
// 原始 ARK 业务 API（api/v3）保留为备选（设置 DOUBAO_BASE_URL 覆盖）。
// ARK Coding Plan 不支持 web_search tool，所以这里是纯 LLM 回答（无联网）。
import type { RealSearchProvider, SearchOptions, SearchResult, ProviderDiagnostics } from "./index";

const ARK_CODING_ENDPOINT = "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions";
const ARK_CODING_MODEL = "doubao-seed-2.0-lite";
const ARK_BUSINESS_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const ARK_BUSINESS_MODEL = "doubao-lite-32k";

export class DoubaoProvider implements RealSearchProvider {
  name = "doubao" as const;

  isAvailable(): boolean {
    return Boolean(process.env.DOUBAO_API_KEY) || Boolean(process.env.ARK_API_KEY);
  }

  getDiagnostics(): ProviderDiagnostics {
    const missing: string[] = [];
    const hasDoubaoKey = Boolean(process.env.DOUBAO_API_KEY);
    const hasArkKey = Boolean(process.env.ARK_API_KEY);
    
    if (!hasDoubaoKey && !hasArkKey) {
      missing.push("DOUBAO_API_KEY or ARK_API_KEY");
    }
    
    return {
      isConfigured: missing.length === 0,
      isAvailable: this.isAvailable(),
      missingEnvVars: missing,
      lastChecked: new Date(),
    };
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    // ARK Coding Plan 优先：如果 DOUBAO_API_KEY 缺失但 ARK_API_KEY 在，则用 ARK Coding Plan 跑 doubao-seed-2.0-lite
    // 注意：用 || 而非 ??，因为空字符串 "" 也会触发 fallback
    const useArkCoding = !process.env.DOUBAO_API_KEY && Boolean(process.env.ARK_API_KEY);
    const apiKey = process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || "";
    if (!apiKey) throw new Error("DOUBAO_API_KEY or ARK_API_KEY is required for doubao provider");

    const baseUrl = process.env.DOUBAO_BASE_URL || (useArkCoding ? ARK_CODING_ENDPOINT : ARK_BUSINESS_ENDPOINT);
    const model = process.env.DOUBAO_MODEL || (useArkCoding ? ARK_CODING_MODEL : ARK_BUSINESS_MODEL);
    const start = Date.now();

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是豆包，由字节跳动提供的人工智能助手。擅长中英文对话，提供有帮助的回答。" },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Doubao API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const answer = json.choices[0]?.message.content ?? "";
    const truncated = answer.slice(0, options.maxAnswerChars ?? 8000);

    return {
      answer: truncated,
      citations: [], // ARK Coding Plan 无 web_search，无引用
      raw: { model, gateway: useArkCoding ? "ark-coding" : "ark-business", durationMs: Date.now() - start },
      durationMs: Date.now() - start,
    };
  }
}
