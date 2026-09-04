// /api/dashboard/activity 单元测试
// 2026-07-23:回归保护
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockRequireSession = vi.fn();
const mockResolveAccessibleProjectIds = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    geoRun: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    auditLog: { findMany: (...a: unknown[]) => mockFindMany(...a) },
    llmCall: { findMany: (...a: unknown[]) => mockFindMany(...a) },
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
  resolveAccessibleProjectIds: (...a: unknown[]) => mockResolveAccessibleProjectIds(...a),
}));

vi.mock("@/lib/api/response", () => ({
  success: (data: unknown) => ({ status: 200, body: { data, error: null } }),
  handleError: () => ({ status: 500 }),
}));

import { GET } from "./route";

function buildReq(query = ""): Request {
  return new Request(`http://x/api/dashboard/activity${query}`, { method: "GET" });
}

describe("GET /api/dashboard/activity", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockRequireSession.mockReset();
    mockResolveAccessibleProjectIds.mockReset();
    mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    mockResolveAccessibleProjectIds.mockResolvedValue(["p1"]);
  });

  it("combines GEO runs + audit + LLM calls sorted by time", async () => {
    // 三种 mock 顺序,期望按 ts 倒序
    // USER_LOGIN 会被过滤,所以 audit 只剩 1 条
    mockFindMany
      .mockResolvedValueOnce([
        { id: "g1", status: "SUCCESS", finishedAt: new Date("2026-07-23T10:00:00Z"), totalQuestions: 3, answeredQuestions: 3, projectId: "p1", _count: { results: 3 }, project: { name: "森田100" } },
      ])
      .mockResolvedValueOnce([
        { id: "a1", action: "USER_LOGIN", targetType: null, targetId: null, userId: "u1", createdAt: new Date("2026-07-23T11:00:00Z"), user: { email: "admin@example.com" } },
        { id: "a2", action: "GEO_RUN_TRIGGER", targetType: "Project", targetId: "p1x", userId: "u1", createdAt: new Date("2026-07-23T09:00:00Z"), user: { email: "admin@example.com" } },
      ])
      .mockResolvedValueOnce([
        { id: "l1", provider: "ark", model: "qwen3.8", jobType: "geo-analysis", costCents: 5, success: true, errorMessage: null, createdAt: new Date("2026-07-23T12:00:00Z"), projectId: "p1" },
      ]);

    const res = await GET(buildReq("?limit=10") as never);
    const data = (res as unknown as { body: { data: { items: Array<{ ts: string; kind: string; title: string }> } } }).body.data;
    expect(data.items.length).toBe(3); // USER_LOGIN 过滤掉
    // 时间倒序:12:00(llm),10:00(geo),9:00(audit=11被过滤)
    expect(data.items[0].ts).toBe("2026-07-23T12:00:00.000Z");
    expect(data.items[0].kind).toBe("llm_call");
    expect(data.items[1].kind).toBe("geo_run");
    expect(data.items[2].kind).toBe("audit");
    expect(data.items[2].title).toContain("GEO_RUN_TRIGGER");
  });

  it("skips USER_LOGIN / USER_LOGOUT from audit feed", async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "a1", action: "USER_LOGIN", targetType: null, targetId: null, userId: "u1", createdAt: new Date(), user: { email: "u" } },
        { id: "a2", action: "BRAND_CREATE", targetType: "Brand", targetId: "b1", userId: "u1", createdAt: new Date(), user: { email: "u" } },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET(buildReq() as never);
    const data = (res as unknown as { body: { data: { items: Array<{ title: string }> } } }).body.data;
    expect(data.items.length).toBe(1);
    expect(data.items[0].title).toContain("BRAND_CREATE");
  });

  it("rejects limit > 50 with 400", async () => {
    const res = await GET(buildReq("?limit=51") as never);
    // 实际 route 不走 handleError,直接 new Response(400)。用 status 400 断言。
    expect((res as { status: number }).status).toBe(400);
  });

  it("uses projectId filter when provided", async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await GET(buildReq("?projectId=p1") as never);
    // 第一次 prisma.geoRun.findMany 调用的 where 应该含 projectId
    expect(mockResolveAccessibleProjectIds).toHaveBeenCalledWith("u1", "MEMBER", "p1");
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({ where: { projectId: { in: ["p1"] } } });
  });

  it("returns requireSession when not logged in", async () => {
    mockRequireSession.mockRejectedValue(new Error("unauthorized"));
    const res = await GET(buildReq() as never);
    expect((res as { status: number }).status).toBe(500);
  });
});
