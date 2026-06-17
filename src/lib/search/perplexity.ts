// Perplexity API 实现（英文）。
// 详细说明见 dev doc v1.2 4.6 节。
// Perplexity 使用 OpenAI 兼容协议，但模型是带 "online" 后缀的（如 sonar-small-online）。
import type { RealSearchProvider, SearchOptions, SearchResult, ProviderDiagnostics } from "./index";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const DEFAULT_MODEL = "llama-3.1-sonar-small-128k-online";

export class PerplexityProvider implements RealSearchProvider {
  name = "perplexity" as const;

  isAvailable(): boolean {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  }

  getDiagnostics(): ProviderDiagnostics {
    const missing: string[] = [];
    if (!process.env.PERPLEXITY_API_KEY) {
      missing.push("PERPLEXITY_API_KEY");
    }
    return {
      isConfigured: missing.length === 0,
      isAvailable: this.isAvailable(),
      missingEnvVars: missing,
      lastChecked: new Date(),
    };
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY is not set");

    const model = process.env.PERPLEXITY_MODEL ?? DEFAULT_MODEL;
    const start = Date.now();

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Provide concise, factual answers based on current web information. Include source URLs.",
          },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        // Perplexity 特定：返回搜索引用
        return_citations: true,
        // 限制搜索地区
        ...(options.region ? { search_region: options.region } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Perplexity API error: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      citations?: string[];
    };

    const answer = json.choices[0]?.message.content ?? "";
    // citations 可能是字符串数组或对象数组，需要处理
    const citations = this.parseCitations(json.citations);
    const truncated = answer.slice(0, options.maxAnswerChars ?? 8000);

    return {
      answer: truncated,
      citations,
      raw: { model, durationMs: Date.now() - start },
      durationMs: Date.now() - start,
    };
  }

  private parseCitations(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((c) => {
        if (typeof c === "string") return c;
        if (typeof c === "object" && c !== null) {
          // Perplexity 可能返回对象格式：{ url: string }
          const obj = c as Record<string, unknown>;
          if (typeof obj.url === "string") return obj.url;
          if (typeof obj.text === "string") return obj.text;
        }
        return String(c);
      }).filter(Boolean);
    }
    return [];
  }
}
