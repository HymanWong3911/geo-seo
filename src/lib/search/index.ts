// 真实 AI 搜索渠道抽象。
// 详细说明见 dev doc v1.1 18.3 节。
//
// 业务代码只依赖 RealSearchProvider 接口，不直接调用任何渠道 SDK。
// 渠道实现位于 ./perplexity.ts / ./kimi.ts / ./doubao.ts / ./llm_simulation.ts。
export type SearchProviderName =
  | "perplexity"
  | "kimi"
  | "doubao"
  | "llm_simulation";

export interface SearchOptions {
  language: string;
  region: string;
  maxAnswerChars?: number;
}

export interface SearchResult {
  answer: string;
  citations: string[];
  raw?: unknown;
  durationMs: number;
}

export interface RealSearchProvider {
  name: SearchProviderName;
  search(query: string, options: SearchOptions): Promise<SearchResult>;
  isAvailable(): boolean;
  getDiagnostics(): ProviderDiagnostics;
}

export interface ProviderDiagnostics {
  isConfigured: boolean;
  isAvailable: boolean;
  missingEnvVars: string[];
  error?: string;
  lastChecked?: Date;
}

import { PerplexityProvider } from "./perplexity";
import { KimiProvider } from "./kimi";
import { DoubaoProvider } from "./doubao";
import { LlmSimulationProvider } from "./llm_simulation";

export const providers: Record<SearchProviderName, RealSearchProvider> = {
  perplexity: new PerplexityProvider(),
  kimi: new KimiProvider(),
  doubao: new DoubaoProvider(),
  llm_simulation: new LlmSimulationProvider(),
};

// 别名导出，方便测试和业务代码按 Map 风格迭代
export const searchProviders = providers;

// 渠道可用性：缺 key / baseUrl 的渠道会被跳过，
// 不会进入 5 次重试 + 长退避（避免 7 分钟起步）。
// kimi / doubao 可以复用 ARK_API_KEY（ARK Coding Plan 订阅版 key 共用）。
export function getAvailableChannels(): SearchProviderName[] {
  const all: SearchProviderName[] = ["perplexity", "kimi", "doubao", "llm_simulation"];
  return all.filter((name) => {
    const provider = providers[name];
    return provider.isAvailable();
  });
}

/**
 * 获取所有渠道的诊断信息，用于前端展示配置状态
 */
export function getAllChannelsDiagnostics(): Record<SearchProviderName, ProviderDiagnostics> {
  const result = {} as Record<SearchProviderName, ProviderDiagnostics>;
  for (const name of Object.keys(providers) as SearchProviderName[]) {
    result[name] = providers[name].getDiagnostics();
  }
  return result;
}

export function getSearchProvider(
  name: SearchProviderName,
): RealSearchProvider {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown search provider: ${name}`);
  }
  return provider;
}

export function getDefaultChannels(): SearchProviderName[] {
  const env = process.env.GEO_DEFAULT_CHANNELS ?? "perplexity,kimi,doubao";
  return env.split(",").map((s) => s.trim()) as SearchProviderName[];
}
