// LLM 模拟搜索（当所有真实渠道不可用时的 fallback）。
// 详细说明见 dev doc v1.1 18.4 节。
import type { RealSearchProvider, SearchOptions, SearchResult, ProviderDiagnostics } from "./index";
import { getLLMProvider } from "@/lib/llm";
import { trackLLMCallWithUsage } from "@/lib/llm/tracker";

export class LlmSimulationProvider implements RealSearchProvider {
  name = "llm_simulation" as const;

  isAvailable(): boolean {
    // 只要有任意 LLM API key 就能用
    return Boolean(process.env.LLM_API_KEY) ||
           Boolean(process.env.OPENAI_API_KEY) ||
           Boolean(process.env.ARK_API_KEY) ||
           Boolean(process.env.ANTHROPIC_API_KEY);
  }

  getDiagnostics(): ProviderDiagnostics {
    const missing: string[] = [];
    const hasLlmKey = Boolean(process.env.LLM_API_KEY);
    const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
    const hasArkKey = Boolean(process.env.ARK_API_KEY);
    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
    
    if (!hasLlmKey && !hasOpenAiKey && !hasArkKey && !hasAnthropicKey) {
      missing.push("LLM_API_KEY (or OPENAI_API_KEY, ARK_API_KEY, ANTHROPIC_API_KEY)");
    }
    
    return {
      isConfigured: missing.length === 0,
      isAvailable: this.isAvailable(),
      missingEnvVars: missing,
      lastChecked: new Date(),
    };
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const llm = getLLMProvider();
    const start = Date.now();

    const prompt = `你是一个地理 SEO 搜索引擎。请回答以下问题，用 ${options.language} 语言回答。

问题：${query}
${options.region ? `地区：${options.region}` : ""}

请提供一个简洁、有帮助的回答，引用相关的来源（如果有的话）。`;

    try {
      const answer = await trackLLMCallWithUsage(
        {
          jobType: "llm-fallback",
          provider: llm.name,
          model: process.env.DEFAULT_LLM_MODEL ?? "unknown",
        },
        llm,
        {
          prompt,
        },
      );

      return {
        answer,
        citations: [],
        raw: { provider: llm.name, durationMs: Date.now() - start },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      throw new Error(`LLM simulation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
