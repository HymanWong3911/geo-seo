// /api/llm/usage 单元测试
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAggregate = vi.fn();
const mockGroupBy = vi.fn();
const mockFindMany = vi.fn();
const mockRequireSession = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    llmCall: {
      aggregate: (...a: unknown[]) => mockAggregate(...a),
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    $queryRaw: (...a: unknown[]) => mockFindMany(...a), // byDay 走 $queryRaw
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
}));

vi.mock("@/lib/api/response", () => ({
  success: (data: unknown) => ({ status: 200, body: { data, error: null } }),
  handleError: () => ({ status: 500 }),
}));

import { GET } from "./route";

function buildReq(query = ""): Request {
  return new Request(`http://x/api/llm/usage${query}`, { method: "GET" });
}

describe("GET /api/llm/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "u1" } });
    mockAggregate.mockResolvedValue({
      _count: { id: 50 },
      _sum: { promptTokens: 30000, completionTokens: 60000, totalTokens: 90000, costCents: 18 },
      _avg: { durationMs: 1200 },
    });
    mockGroupBy.mockResolvedValueOnce([
      { model: "qwen3.8-max-preview", provider: "bailian", _count: { id: 30 }, _sum: { promptTokens: 18000, completionTokens: 36000, totalTokens: 54000, costCents: 11 }, _avg: { durationMs: 1500 } },
      { model: "MiniMax-M3", provider: "ark", _count: { id: 20 }, _sum: { promptTokens: 12000, completionTokens: 24000, totalTokens: 36000, costCents: 7 }, _avg: { durationMs: 800 } },
    ]);
    mockGroupBy.mockResolvedValueOnce([
      { provider: "bailian", _count: { id: 30 }, _sum: { totalTokens: 54000, costCents: 11 } },
    ]);
    mockGroupBy.mockResolvedValueOnce([
      { jobType: "geo-analysis", _count: { id: 25 }, _sum: { totalTokens: 45000, costCents: 9 } },
    ]);
    mockFindMany.mockResolvedValueOnce([
      { day: new Date("2026-07-23T00:00:00Z"), calls: BigInt(40), tokens: BigInt(80000), cost: 16 },
    ]);
  });

  it("returns totals + byModel + byProvider + byJobType + byDay", async () => {
    const res = await GET(buildReq("?days=7") as never);
    const data = (res as unknown as { body: { data: { totals: { calls: number }; byModel: Array<{ model: string }> } } }).body.data;
    expect(data.totals.calls).toBe(50);
    expect(data.totals.totalTokens).toBe(90000);
    expect(data.totals.recordedCostCents).toBe(18);
    expect(data.totals.avgDurationMs).toBe(1200);
    expect(data.byModel.length).toBe(2);
    expect(data.byModel[0].model).toBe("qwen3.8-max-preview");
    expect(data.byModel[0].provider).toBe("bailian");
    expect(data.byModel[0].calls).toBe(30);
    expect(data.byProvider[0].provider).toBe("bailian");
    expect(data.byJobType[0].jobType).toBe("geo-analysis");
  });

  it("defaults days to 7 when no query", async () => {
    await GET(buildReq() as never);
    // since 字段是动态日期,检查 prisma aggregate 的 where.createdAt.gte 是 7 天前
    const sinceCall = mockAggregate.mock.calls[0][0] as { where: { createdAt: { gte: Date } } };
    const since = sinceCall.where.createdAt.gte;
    const diff = Date.now() - since.getTime();
    const days = diff / (24 * 3600 * 1000);
    expect(days).toBeGreaterThan(6.5);
    expect(days).toBeLessThan(7.5);
  });

  it("rejects days > 365 with 400", async () => {
    const res = await GET(buildReq("?days=500") as never);
    expect((res as { status: number }).status).toBe(400);
  });
});
