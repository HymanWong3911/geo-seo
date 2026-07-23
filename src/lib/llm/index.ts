// LLM Provider 抽象。
// 详细说明见 dev doc v1.2 4.6 节。
// 业务代码只依赖 LLMProvider 接口。

export interface LLMCompleteInput {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompleteResult {
  content: string;
  usage?: LLMUsage;
}

export interface LLMProvider {
  name: string;
  complete(input: LLMCompleteInput): Promise<string>;
  completeWithUsage?(input: LLMCompleteInput): Promise<LLMCompleteResult>;
  estimateCost?(input: LLMCompleteInput): number;
}

import { OpenAIProvider } from "./openai";
import { OpenAICompatibleProvider } from "./openai_compatible";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { CustomHTTPProvider } from "./custom_http";
import { ARKProvider } from "./ark";
import { BailianProvider } from "./bailian";
import { MockLLMProvider } from "./mock";

export const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  openai_compatible: new OpenAICompatibleProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  custom_http: new CustomHTTPProvider(),
  ark: new ARKProvider(),
  // 2026-07-23: ARK 周配额耗尽时,百炼(DashScope) 是 LLM 真实调用第一备选。
  bailian: new BailianProvider(),
  // 2026-07-23: ARK 配额耗尽且无 Bailian key 时,用 mock 不阻塞链路。
  mock: new MockLLMProvider(),
};

export function getLLMProvider(name?: string): LLMProvider {
  // 2026-07-23 优先级链:
  //   1. 显式 name 参数
  //   2. GEO_RUN_MOCK_LLM=true → mock(开发/CI 强制走本地合成)
  //   3. BAILIAN_API_KEY 或 DASHSCOPE_API_KEY 已配置 → bailian(真实 DashScope 调用)
  //   4. DEFAULT_LLM_PROVIDER(原生产路径,通常是 ark)
  //
  // 这样生产路径完全不变;mock 和 bailian 都是显式 opt-in,不会静默切换。
  const explicit = name ?? null;
  const key =
    explicit ??
    (process.env.GEO_RUN_MOCK_LLM === "true"
      ? "mock"
      : (process.env.BAILIAN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? process.env.GROK_BAILIAN_API_KEY)
        ? "bailian"
        : (process.env.DEFAULT_LLM_PROVIDER ?? "openai_compatible"));
  const provider = providers[key];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${key}`);
  }
  return provider;
}

// 别名：业务代码常用 LLMFactory 名称，留个兼容
export const LLMFactory = {
  get: getLLMProvider,
  list: () => Object.keys(providers),
};
