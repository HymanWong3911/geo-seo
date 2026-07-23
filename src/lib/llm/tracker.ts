// LLM 调用追踪 wrapper。
// 用法：const { result, call } = await trackLLMCall("geo-analysis", async () => llm.complete(...));
// 详细说明见 dev doc v1.2 25.2 节。
import { prisma } from "@/lib/db";
import type { LLMCompleteResult, LLMProvider } from "./index";

const COST_INPUT_PER_1K = parseFloat(process.env.LLM_COST_INPUT_PER_1K ?? "0.0014");
const COST_OUTPUT_PER_1K = parseFloat(process.env.LLM_COST_OUTPUT_PER_1K ?? "0.0028");

export interface TrackOptions {
  jobType:
    | "real-search"
    | "llm-fallback"
    | "geo-analysis"
    | "content-analysis"
    | "report-generation"
    | "keyword-expand"
    | "draft-generate"
    | "draft-rewrite"
    | "brand-monitor"
    | "integration-test";
  provider: string;
  model: string;
  projectId?: string | null;
  geoRunId?: string | null;
}

function estimateTokens(text: string): number {
  // 粗略估算：中文约 1.5 字符/token，英文约 4 字符/token
  // 取平均值约 2.5 字符/token
  return Math.ceil(text.length / 2.5);
}

function estimateCostFromTokens(promptTokens: number, completionTokens: number): number {
  // costCents：分（100 cents = 1 元）
  const input = (promptTokens / 1000) * COST_INPUT_PER_1K * 100;
  const output = (completionTokens / 1000) * COST_OUTPUT_PER_1K * 100;
  return Math.round((input + output) * 10000) / 10000;
}

/**
 * 执行 LLM 调用并追踪。
 * 如果 provider 实现了 completeWithUsage，则使用真实的 token 计数；
 * 否则使用估算值。
 */
export async function trackLLMCall<T extends string>(
  options: TrackOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  let result: T | undefined;
  let success = true;
  let errorMessage: string | null = null;
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    result = await fn();
    return result;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    // 失败也记一笔
    void (async () => {
      try {
        await prisma.llmCall.create({
          data: {
            projectId: options.projectId ?? null,
            geoRunId: options.geoRunId ?? null,
            jobType: options.jobType,
            provider: options.provider,
            model: options.model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costCents: 0,
            durationMs,
            success: false,
            errorMessage,
          },
        });
      } catch (writeErr) {
        // eslint-disable-next-line no-console
        console.error("[trackLLMCall] failed to record error:", writeErr);
      }
    })();
    throw err;
  } finally {
    if (success && result !== undefined) {
      const durationMs = Date.now() - start;
      const completion = typeof result === "string" ? result : "";
      
      // 尝试估算 token 使用（作为 fallback）
      const promptTokens = estimateTokens("");
      const completionTokens = estimateTokens(completion);
      const totalTokens = promptTokens + completionTokens;
      const costCents = estimateCostFromTokens(promptTokens, completionTokens);

      // 异步写库（不阻塞主流程）
      void (async () => {
        try {
          await prisma.llmCall.create({
            data: {
              projectId: options.projectId ?? null,
              geoRunId: options.geoRunId ?? null,
              jobType: options.jobType,
              provider: options.provider,
              model: options.model,
              promptTokens: usage.promptTokens || promptTokens,
              completionTokens: usage.completionTokens || completionTokens,
              totalTokens: usage.totalTokens || totalTokens,
              costCents,
              durationMs,
              success: true,
              errorMessage: null,
            },
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[trackLLMCall] failed to record:", err);
        }
      })();
    }
  }
}

/**
 * 封装带 usage 追踪的 LLM 调用。
 * 如果 provider 支持 completeWithUsage，使用真实 token 计数；
 * 否则使用估算值。
 */
// 2026-07-23: 把 model 字段按 provider 路由真实模型名称,而不是锁死 DEFAULT_LLM_MODEL。
// 三个 provider 各自从不同 env 读默认,所以分发逻辑收敛在这里。
function resolveProviderModel(providerName: string): string {
  switch (providerName) {
    case "ark":
      return process.env.ARK_MODEL ?? "ark-code-latest";
    case "bailian":
      return (
        process.env.BAILIAN_MODEL
        ?? process.env.GROK_BAILIAN_MODEL
        ?? "qwen3.8-max-preview"
      );
    case "openai_compatible":
      return process.env.DEFAULT_LLM_MODEL ?? process.env.LLM_MODEL ?? "deepseek-chat";
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet";
    case "google":
      return process.env.GOOGLE_MODEL ?? "gemini-1.5-pro";
    case "custom_http":
      return process.env.LLM_CUSTOM_HTTP_MODEL ?? "custom";
    case "mock":
      return "mock-synthesized";
    default:
      return process.env.DEFAULT_LLM_MODEL ?? "unknown";
  }
}

export async function trackLLMCallWithUsage(
  options: TrackOptions,
  provider: LLMProvider,
  input: { system?: string; prompt: string },
): Promise<string> {
  const start = Date.now();
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    let content: string;

    if (provider.completeWithUsage) {
      // 使用带 usage 的方法
      const result = await provider.completeWithUsage(input);
      content = result.content;
      if (result.usage) {
        usage = result.usage;
      }
    } else {
      // 回退到普通方法，估算 token
      content = await provider.complete(input);
      usage.promptTokens = estimateTokens((input.system ?? "") + input.prompt);
      usage.completionTokens = estimateTokens(content);
      usage.totalTokens = usage.promptTokens + usage.completionTokens;
    }

    const durationMs = Date.now() - start;
    const costCents = estimateCostFromTokens(usage.promptTokens, usage.completionTokens);
    const modelName = resolveProviderModel(provider.name);

    // 异步写库
    void (async () => {
      try {
        await prisma.llmCall.create({
          data: {
            projectId: options.projectId ?? null,
            geoRunId: options.geoRunId ?? null,
            jobType: options.jobType,
            provider: provider.name,
            model: modelName,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            costCents,
            durationMs,
            success: true,
            errorMessage: null,
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[trackLLMCallWithUsage] failed to record:", err);
      }
    })();

    return content;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    void (async () => {
      try {
        await prisma.llmCall.create({
          data: {
            projectId: options.projectId ?? null,
            geoRunId: options.geoRunId ?? null,
            jobType: options.jobType,
            provider: provider.name,
            model: process.env.DEFAULT_LLM_MODEL ?? "unknown",
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costCents: 0,
            durationMs,
            success: false,
            errorMessage,
          },
        });
      } catch (writeErr) {
        // eslint-disable-next-line no-console
        console.error("[trackLLMCallWithUsage] failed to record error:", writeErr);
      }
    })();

    throw err;
  }
}
