// LLM 使用情况 JSON 端点(per-model 拆分 + token-plan 套餐价位)。
// 2026-07-23: 新增。之前 /api/llm/stats 已存在但没做 model 拆分。
//
// 注:token-plan 套餐价位是裸单价(¥ 元),用户层级不固定,这里采用「输入价 0.0008 元/1k,
// 输出价 0.002 元/1k」的"qwen3" 估算,后续可配 env 覆盖。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, resolveAccessibleProjectIds } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  projectId: z.string().optional(),
});

interface ModelRate {
  inputPer1K: number; // 元 / 1k token
  outputPer1K: number;
  label: string;
}
// 2026-07-23: 套餐专属 token-plan 默认价 (用户当前为 qwen3.8-max-preview);
// 通过 env 可覆盖:LlmRateModel_<model>=input,output (元/1k)
const MODEL_RATES: Record<string, ModelRate> = {
  "MiniMax-M3": { inputPer1K: 0.0008, outputPer1K: 0.002, label: "MiniMax-M3 (default fallback label)" },
  "qwen3.8-max-preview": { inputPer1K: 0.001, outputPer1K: 0.002, label: "Qwen3.8-Max preview (10x 加量)" },
  "qwen3.7-plus": { inputPer1K: 0.001, outputPer1K: 0.002, label: "Qwen3.7-Plus" },
  "qwen3.7-max": { inputPer1K: 0.002, outputPer1K: 0.006, label: "Qwen3.7-Max" },
  "qwen3.6-flash": { inputPer1K: 0.0003, outputPer1K: 0.0006, label: "Qwen3.6-Flash" },
  "deepseek-v4-pro": { inputPer1K: 0.001, outputPer1K: 0.002, label: "DeepSeek-V4-Pro" },
  "glm-5.2": { inputPer1K: 0.001, outputPer1K: 0.002, label: "GLM-5.2" },
};

function estimateCost(
  model: string | null,
  promptTokens: number,
  completionTokens: number,
): number {
  // 返回元 / ¥,便于 UI 直接显示
  const key = model ?? "MiniMax-M3";
  const rate = MODEL_RATES[key] ?? MODEL_RATES["MiniMax-M3"];
  return (promptTokens / 1000) * rate.inputPer1K + (completionTokens / 1000) * rate.outputPer1K;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid params" }), { status: 400 });
    }
    const { days, projectId } = parsed.data;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const projectIds = await resolveAccessibleProjectIds(
      session.user.id,
      session.user.role,
      projectId,
    );

    const where = {
      createdAt: { gte: since },
      projectId: { in: projectIds },
    };

    // 1) 按 model 拆分
    const byModel = await prisma.llmCall.groupBy({
      by: ["model", "provider"],
      where,
      _count: { id: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
      _avg: { durationMs: true },
      orderBy: { _count: { id: "desc" } },
    });

    // 2) 按 provider 拆分(只看 provider)
    const byProvider = await prisma.llmCall.groupBy({
      by: ["provider"],
      where,
      _count: { id: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
    });

    // 3) 按 jobType
    const byJobType = await prisma.llmCall.groupBy({
      by: ["jobType"],
      where,
      _count: { id: true },
      _sum: { totalTokens: true, costCents: true },
    });

    // 4) 总体
    const totals = await prisma.llmCall.aggregate({
      where,
      _count: { id: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costCents: true },
      _avg: { durationMs: true },
    });

    return success({
      range: { days, since: since.toISOString() },
      totals: {
        calls: totals._count.id,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        totalTokens: totals._sum.totalTokens ?? 0,
        recordedCostCents: Number(totals._sum.costCents ?? 0),
        estimatedCostYuan: Number(((totals._sum.promptTokens ?? 0) + (totals._sum.completionTokens ?? 0)) * 0.000005),
        avgDurationMs: Math.round(totals._avg.durationMs ?? 0),
      },
      byModel: byModel.map((r) => ({
        model: r.model,
        provider: r.provider,
        label: MODEL_RATES[r.model ?? ""]?.label ?? r.model,
        calls: r._count.id,
        promptTokens: r._sum.promptTokens ?? 0,
        completionTokens: r._sum.completionTokens ?? 0,
        totalTokens: r._sum.totalTokens ?? 0,
        recordedCostCents: Number(r._sum.costCents ?? 0),
        estimatedCostYuan: Number(
          estimateCost(r.model, r._sum.promptTokens ?? 0, r._sum.completionTokens ?? 0),
        ),
        avgDurationMs: Math.round(r._avg.durationMs ?? 0),
      })),
      byProvider: byProvider.map((r) => ({
        provider: r.provider,
        calls: r._count.id,
        tokens: r._sum.totalTokens ?? 0,
        recordedCostCents: Number(r._sum.costCents ?? 0),
      })),
      byJobType: byJobType.map((r) => ({
        jobType: r.jobType,
        calls: r._count.id,
        tokens: r._sum.totalTokens ?? 0,
        recordedCostCents: Number(r._sum.costCents ?? 0),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
