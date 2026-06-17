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

export const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  openai_compatible: new OpenAICompatibleProvider(),
  anthropic: new AnthropicProvider(),
  google: new GoogleProvider(),
  custom_http: new CustomHTTPProvider(),
  ark: new ARKProvider(),
};

export function getLLMProvider(name?: string): LLMProvider {
  const key = name ?? process.env.DEFAULT_LLM_PROVIDER ?? "openai_compatible";
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
