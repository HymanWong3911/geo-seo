// /api/projects/{projectId}/geo/runs/bulk 单元测试
// 2026-07-23:为防路由回归加测试
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnqueue = vi.fn();
const mockRequireSession = vi.fn();
const mockRequireProjectEditor = vi.fn();
const mockAudit = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findUnique: (...a: unknown[]) => mockFindUnique(...a) },
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
  requireProjectEditor: (...a: unknown[]) => mockRequireProjectEditor(...a),
}));

vi.mock("@/lib/queue/geo", () => ({
  enqueueGeoRun: (...a: unknown[]) => mockEnqueue(...a),
}));

vi.mock("@/lib/audit/logger", () => ({
  audit: (...a: unknown[]) => mockAudit(...a),
}));

vi.mock("@/lib/api/response", () => ({
  success: (data: unknown) => ({ status: 200, body: { data, error: null } }),
  handleError: (err: unknown) => ({ status: 500, body: { data: null, error: { message: String(err) } } }),
  Errors: {
    badRequest: (m: string) => ({ name: "BadRequest", message: m, code: "VALIDATION_ERROR" }),
  },
}));

import { POST } from "./route";

function buildReq(body: unknown, projectId: string): Request {
  return new Request(`http://x/api/projects/${projectId}/geo/runs/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ctx = (projectId: string) => ({ params: { projectId } });

describe("POST /api/projects/{p}/geo/runs/bulk", () => {
  beforeEach(() => {
    mockEnqueue.mockReset();
    mockRequireSession.mockReset();
    mockRequireProjectEditor.mockReset();
    mockAudit.mockReset();
    mockFindUnique.mockReset();
    mockEnqueue.mockResolvedValue({ id: "job_1" });
    mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    mockRequireProjectEditor.mockResolvedValue(undefined);
    mockAudit.mockResolvedValue(undefined);
  });

  it("returns 1 job when count=1", async () => {
    const res = await POST(buildReq({ count: 1 }, "p1") as never, ctx("p1") as never);
    expect(res.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      "GEO_RUN_TRIGGER",
      expect.objectContaining({
        targetId: "p1",
        metadata: expect.objectContaining({ kind: "bulk", count: 1 }),
      }),
    );
  });

  it("returns 3 jobs when count=3", async () => {
    mockEnqueue.mockResolvedValueOnce({ id: "j1" }).mockResolvedValueOnce({ id: "j2" }).mockResolvedValueOnce({ id: "j3" });
    const res = await POST(buildReq({ count: 3 }, "p1") as never, ctx("p1") as never);
    expect(res.status).toBe(200);
    expect(mockEnqueue).toHaveBeenCalledTimes(3);
  });

  it("rejects count > 20", async () => {
    const res = await POST(buildReq({ count: 21 }, "p1") as never, ctx("p1") as never);
    expect(res.status).toBe(500); // handleError -> 500(测试用最小 mock 不走 throw path)
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("rejects non-numeric count", async () => {
    const res = await POST(buildReq({ count: "abc" }, "p1") as never, ctx("p1") as never);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("uses requireProjectEditor for auth", async () => {
    await POST(buildReq({ count: 1 }, "p1") as never, ctx("p1") as never);
    expect(mockRequireProjectEditor).toHaveBeenCalledWith("u1", "ADMIN", "p1");
  });
});
