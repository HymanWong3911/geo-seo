// 渠道调度核心。
// 详细说明见 dev doc v1.1 18.10 节。
import {
  getSearchProvider,
  getDefaultChannels,
  getAvailableChannels,
  type SearchResult,
  type SearchProviderName,
} from "@/lib/search";
import { prisma } from "@/lib/db";

const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 480_000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runGeoQuestion(
  projectId: string,
  questionId: string,
  questionText: string,
  language: string,
  region: string,
): Promise<{
  result: SearchResult;
  provider: SearchProviderName;
  attempts: number;
}> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project not found: ${projectId}`);

  // 优先级：项目配置的渠道 ∩ 实际可用的渠道（已配 key）
  // 没配 key 的渠道会被跳过（避免进入 5 次重试 + 7.5 分钟退避）
  const configured = project.geoChannels.length > 0
    ? (project.geoChannels as SearchProviderName[])
    : getDefaultChannels();
  const available = new Set(getAvailableChannels());
  const channels = configured.filter((c) => available.has(c));

  if (channels.length === 0) {
    // 没有任何配置的渠道可用：直接走 LLM fallback（不进入退避循环）
    if (process.env.GEO_FALLBACK_TO_LLM !== "true") {
      throw new Error("No GEO channels available and fallback disabled");
    }
    const llmProvider = getSearchProvider("llm_simulation");
    const result = await llmProvider.search(questionText, {
      language,
      region,
      maxAnswerChars: parseInt(process.env.GEO_ANSWER_MAX_CHARS ?? "8000"),
    });
    return { result, provider: "llm_simulation", attempts: 0 };
  }

  for (const channelName of channels) {
    const provider = getSearchProvider(channelName);

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const result = await provider.search(questionText, {
          language,
          region,
          maxAnswerChars: parseInt(process.env.GEO_ANSWER_MAX_CHARS ?? "8000"),
        });
        return { result, provider: channelName, attempts: attempt };
      } catch (err) {
        if (attempt === 5) break;
        await sleep(BACKOFF_MS[attempt - 1]);
      }
    }
  }

  // 所有可用渠道均失败，LLM fallback
  if (process.env.GEO_FALLBACK_TO_LLM !== "true") {
    throw new Error("All GEO channels failed and fallback disabled");
  }
  const llmProvider = getSearchProvider("llm_simulation");
  const result = await llmProvider.search(questionText, {
    language,
    region,
    maxAnswerChars: parseInt(process.env.GEO_ANSWER_MAX_CHARS ?? "8000"),
  });
  return { result, provider: "llm_simulation", attempts: 0 };
}
