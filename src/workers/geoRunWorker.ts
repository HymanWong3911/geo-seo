// GEO 运行 worker。
// 详细说明见 dev doc v1.2 11.1 节。
// 流程：
//   1. 加载项目品牌 + 竞品 + 问题
//   2. 预算检查
//   3. 对每个问题，调用 channel.ts 跑搜索 + LLM 分析
//   4. 写 GeoRun + GeoRunResult + LlmCall
//   5. 失败 → sendAlert

import { Worker } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/logger";
import { runGeoQuestion } from "@/lib/geo/channel";
import { getLLMProvider } from "@/lib/llm";
import { trackLLMCallWithUsage } from "@/lib/llm/tracker";
import { sendAlert } from "@/lib/alert/sender";
import { checkMonthlyBudget } from "@/lib/geo/budget";
import type { GeoRunJob } from "@/lib/queue/geo";

const ANALYSIS_PROMPT = `你是一个搜索可见度分析器。
请分析下面的 AI 回答，提取品牌和竞品出现情况。

主品牌：{primaryBrand}
品牌别名：{brandAliases}
竞品：{competitors}

问题：{question}
AI 回答：
{answer}

请输出 JSON（不要加 markdown 标记，直接输出 JSON）：
{{
  "primaryBrandMentioned": boolean,
  "primaryBrandRecommended": boolean,
  "mentionedBrands": string[],
  "mentionedCompetitors": string[],
  "primaryBrandPosition": number | null,
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "hasOfficialLink": boolean,
  "links": string[],
  "summary": string,
  "missedOpportunities": string[],
  "recommendedActions": string[]
}}`;

async function analyzeWithLLM(
  answer: string,
  question: string,
  primaryBrand: string,
  brandAliases: string[],
  competitors: string[],
  projectId: string,
  geoRunId: string,
): Promise<Record<string, unknown>> {
  const llm = getLLMProvider();
  const prompt = ANALYSIS_PROMPT
    .replace("{primaryBrand}", primaryBrand)
    .replace("{brandAliases}", brandAliases.join(", "))
    .replace("{competitors}", competitors.join(", "))
    .replace("{question}", question)
    .replace("{answer}", answer);

  // 不传 responseFormat: 部分 provider(ARK)不支持 json_object,改用纯 prompt + 自行解析。
  const text = await trackLLMCallWithUsage(
    {
      jobType: "geo-analysis",
      projectId,
      geoRunId,
      provider: llm.name,
      model: process.env.DEFAULT_LLM_MODEL ?? "unknown",
    },
    llm,
    {
      system: "你只输出合法 JSON，不要包含任何额外文字或 markdown 标记。",
      prompt,
    },
  );

  return parseAnalysisJSON(text, question);
}

/**
 * 从 LLM 文本中稳健提取 JSON。
 * 顺序：纯 JSON -> ```json ... ``` 代码块 -> {..} 块 -> 修复常见错误。
 */
export function parseAnalysisJSON(raw: string, contextForError: string): Record<string, unknown> {
  if (!raw || typeof raw !== "string") {
    throw new Error(`LLM analysis returned empty text (${contextForError})`);
  }
  let text = raw.trim();

  // 1. 纯 JSON
  try { return JSON.parse(text); } catch {}

  // 2. Markdown ```json ... ``` 块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }

  // 3. 第一个 { 到最后一个 } 的内容
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch {}
    // 4. 修复常见错误：尾随逗号
    const repaired = candidate.replace(/,(\s*[\]}])/g, "$1");
    try { return JSON.parse(repaired); } catch {}
  }

  throw new Error(`LLM analysis returned invalid JSON (${contextForError}): ${raw.slice(0, 200)}`);
}

export async function runGeoRunSync(job: GeoRunJob): Promise<{
  runId: string;
  totalQuestions: number;
  successCount: number;
  failedCount: number;
  totalCost: number;
}> {
  const { projectId, questionIds, userId, triggerType } = job;

  // 加载项目
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brands: true,
      competitors: true,
    },
  });
  if (!project) throw new Error("Project not found");

  const primaryBrand = project.brands.find((b) => b.isPrimary)?.name ?? project.primaryBrand;
  const brandAliases = project.brands.flatMap((b) => [b.name, ...b.aliases]);
  const competitorNames = project.competitors.map((c) => c.name);

  // 加载问题
  const questions = await prisma.geoQuestion.findMany({
    where: {
      projectId,
      active: true,
      ...(questionIds && questionIds.length > 0 ? { id: { in: questionIds } } : {}),
    },
  });

  // 预算检查
  const budget = await checkMonthlyBudget();
  if (budget.exceeded && process.env.GEO_BUDGET_HARD_LIMIT === "true") {
    throw new Error("月度预算已用完，跳过本次 GEO run");
  }

  // 创建 GeoRun
  const run = await prisma.geoRun.create({
    data: {
      projectId,
      triggerType: triggerType === "SCHEDULED" ? "SCHEDULED" : "MANUAL",
      provider: "multi",
      model: "multi",
      status: "RUNNING",
      questionIds: questions.map((q) => q.id),
      startedAt: new Date(),
    },
  });

  let successCount = 0;
  let failedCount = 0;
  let totalCost = 0;

  for (const question of questions) {
    try {
      const { result, provider, attempts } = await runGeoQuestion(
        projectId,
        question.id,
        question.question,
        question.language,
        question.region,
      );

      // LLM 分析
      const analysis = await analyzeWithLLM(
        result.answer,
        question.question,
        primaryBrand,
        brandAliases,
        competitorNames,
        projectId,
        run.id,
      );

      await prisma.geoRunResult.create({
        data: {
          geoRunId: run.id,
          geoQuestionId: question.id,
          answer: result.answer,
          providerSource: provider,
          providerAttempts: attempts,
          citedUrls: result.citations,
          mentionedBrands: (analysis.mentionedBrands as string[]) ?? [],
          mentionedCompetitors: (analysis.mentionedCompetitors as string[]) ?? [],
          primaryBrandMentioned: Boolean(analysis.primaryBrandMentioned),
          primaryBrandRecommended: Boolean(analysis.primaryBrandRecommended),
          sentiment: (analysis.sentiment as string) ?? null,
          position: typeof analysis.primaryBrandPosition === "number" ? analysis.primaryBrandPosition : null,
          links: (analysis.links as string[]) ?? [],
          analysis: analysis as object,
        },
      });

      successCount++;
      await audit("GEO_RUN_TRIGGER", {
        userId,
        targetType: "GeoRun",
        targetId: run.id,
        metadata: {
          projectId,
          questionId: question.id,
          provider,
          attempts,
          success: true,
        },
      });
    } catch (err) {
      failedCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[geo-run] question ${question.id} failed:`, errMsg);

      await audit("GEO_RUN_TRIGGER", {
        userId,
        targetType: "GeoRun",
        targetId: run.id,
        metadata: {
          projectId,
          questionId: question.id,
          success: false,
          error: errMsg,
        },
      });
    }
  }

  const finalStatus = failedCount === 0 ? "SUCCESS" : successCount === 0 ? "FAILED" : "PARTIAL_FAILURE";
  await prisma.geoRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
    },
  });

  // 告警
  if (failedCount > 0) {
    await sendAlert({
      eventType: "GEO_RUN_FAILED",
      payload: {
        title: `【GEO 监测失败】${project.name}`,
        项目: project.name,
        成功: successCount,
        失败: failedCount,
        总数: questions.length,
      },
    });
  }

  return {
    runId: run.id,
    totalQuestions: questions.length,
    successCount,
    failedCount,
    totalCost,
  };
}

export const geoRunWorker = new Worker<GeoRunJob>(
  "geo-run",
  async (job) => {
    return runGeoRunSync(job.data);
  },
  { connection, concurrency: 3 },
);
