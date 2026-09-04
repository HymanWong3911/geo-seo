// Mock LLM Provider —— 用于 ARK / 其它真实 API 配额耗尽时本地跑通流程。
//
// 触发方式:
//   export GEO_RUN_MOCK_LLM=true
// 然后 GEO 渠道固定走 llm_simulation，且 getLLMProvider() 默认使用本 provider。
//
// 用法:
//   - dev / CI / 本地调试:开启后 search 返回含项目主品牌名的"答案",
//     analyzeWithLLM 返回 primaryBrandMentioned=true 的合法 JSON,
//     这样 mention-rate / 跑通链路能立刻验证。
//   - 生产:严格不打开,默认走真实的 ark(代码路径已固定,完全一致)。
//
// 注意:
//   - 不调用任何外部 API,无网络依赖,完全确定式输出。
//   - LlmCall tracker 仍会记一条(jobType 跟真实调用一致),便于按生产路径调试。
//   - 不模拟重试/退避,这些依赖 provider 行为,mock 直出。

import type { LLMCompleteInput, LLMCompleteResult, LLMProvider } from "./index";

/**
 * 从 prompt 文本里抽出主品牌名。
 * 现状:worker 在 analyzeWithLLM 调用时会用 ANALYSIS_PROMPT 把
 *   主品牌:{primaryBrand}
 * 渲染进 prompt,因此正则能稳健匹配。
 */
function extractPrimaryBrand(prompt: string): string | null {
  const m = prompt.match(/主品牌：([^\n]+)/);
  return m ? m[1].trim() : null;
}

function extractCompetitors(prompt: string): string[] {
  const m = prompt.match(/竞品：([^\n]+)/);
  if (!m) return [];
  return m[1].split(/[,,]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 构造一个"分析调用"应当返回的合法 JSON。
 * 调用方:analyzeWithLLM 在 worker geoRunWorker.ts:47 调用,
 * 它会立刻 JSON.parse(content)。
 *
 * 这里永远让 primaryBrandMentioned=true,让 mention-rate 走得通,
 * 在生产前需替换为真实 LLM 输出。
 */
function buildAnalysisJson(primaryBrand: string, competitors: string[]): string {
  return JSON.stringify({
    primaryBrandMentioned: true,
    primaryBrandRecommended: true,
    mentionedBrands: [primaryBrand],
    mentionedCompetitors: competitors.length > 0 ? [competitors[0]] : [],
    primaryBrandPosition: 1,
    sentiment: "positive",
    hasOfficialLink: false,
    links: [],
    summary: `[mock] 提及了「${primaryBrand}」(测试 / 离线模式)`,
    missedOpportunities: ["可加上品牌官方链接"],
    recommendedActions: ["在文末加品牌官网链接"],
  });
}

/**
 * 构造一个"搜索调用"应当返回的"答案"文本。
 * 调用方:llm_simulation.search (src/lib/search/llm_simulation.ts:39) 调用,
 * 它期待文本里能提到主品牌,让 analyze 那侧 mention 命中。
 */
function buildSearchAnswer(primaryBrand: string, language: string): string {
  // 保持简短但 > 10 字,确保下游 .length > 10 断言通过
  const brand = primaryBrand;
  if (language.startsWith("zh")) {
    return `根据公开信息,${brand} 在连锁咨询领域有一定的市场口碑,适合 GEO 监测为登入搜索可见度。建议参考其官网与行业案例进行下一步评估。`;
  }
  return `According to public sources, ${brand} has a notable presence in its category. Consider evaluating their official channels for GEO visibility.`;
}

export class MockLLMProvider implements LLMProvider {
  name = "mock";

  estimateCost(_input: LLMCompleteInput): number {
    return 0; // 本地 mock 不产生费用,显式 0 让成本报表区分
  }

  async complete(input: LLMCompleteInput): Promise<string> {
    const result = await this.completeWithUsage(input);
    return result.content;
  }

  async completeWithUsage(input: LLMCompleteInput): Promise<LLMCompleteResult> {
    // 1) 优先从 analyze prompt 抽出品牌;搜不到再走 MOCK_DEFAULT_BRAND 环境变量。
    const brand =
      extractPrimaryBrand(input.prompt) ??
      process.env.MOCK_DEFAULT_BRAND ??
      "森田连锁咨询";

    // 2) 区分"搜索"调用 vs "分析"调用:
    //    analyze 调用 system 一般长这样:
    //      "你只输出合法 JSON，不要包含任何额外文字或 markdown 标记。"
    //    搜索调用 system 通常为空(完全交由 prompt 描述)。
    const isAnalysis = !!input.system && /JSON/.test(input.system);

    const competitors = isAnalysis ? extractCompetitors(input.prompt) : [];

    const content = isAnalysis
      ? buildAnalysisJson(brand, competitors)
      : buildSearchAnswer(brand, input.prompt.includes("zh") || !input.prompt ? "zh-CN" : "en-US");

    return {
      content,
      usage: {
        promptTokens: Math.max(0, Math.floor(input.prompt.length / 4)),
        completionTokens: Math.max(0, Math.floor(content.length / 4)),
        totalTokens: 0, // 由 tracker 自己加和
      },
    };
  }
}
