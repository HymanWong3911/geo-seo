import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDraft = vi.fn();
const mockTargetFirst = vi.fn();
const mockTargetUnique = vi.fn();
const mockTargetCount = vi.fn();
const mockRequireSession = vi.fn();
const mockRequireProjectEditor = vi.fn();
const mockManual = vi.fn();
const mockBatch = vi.fn();
const mockValidate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    contentDraft: { findUnique: (...args: unknown[]) => mockDraft(...args) },
    distributionTarget: {
      findFirst: (...args: unknown[]) => mockTargetFirst(...args),
      findUnique: (...args: unknown[]) => mockTargetUnique(...args),
      count: (...args: unknown[]) => mockTargetCount(...args),
    },
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  requireProjectEditor: (...args: unknown[]) => mockRequireProjectEditor(...args),
}));

vi.mock("@/workers/distributionWorker", () => ({
  triggerManualDistribution: (...args: unknown[]) => mockManual(...args),
  triggerBatchDistribution: (...args: unknown[]) => mockBatch(...args),
  validateTargetConfig: (...args: unknown[]) => mockValidate(...args),
}));

vi.mock("@/lib/api/response", () => {
  class TestError extends Error {
    constructor(public status: number) { super(); }
  }
  return {
    Errors: {
      notFound: () => new TestError(404),
      badRequest: () => new TestError(400),
    },
    handleError: (error: unknown) => ({ status: (error as { status?: number }).status ?? 500 }),
    success: (data: unknown) => ({ status: 200, body: { data } }),
  };
});

import { GET, POST } from "./route";

describe("/api/distribution project authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    mockRequireProjectEditor.mockResolvedValue({ role: "EDITOR" });
    mockDraft.mockResolvedValue({ projectId: "p1" });
  });

  it("rejects a target from another project before distribution", async () => {
    mockTargetFirst.mockResolvedValue(null);
    const request = new Request("http://x/api/distribution", {
      method: "POST",
      body: JSON.stringify({ action: "single", draftId: "d1", targetId: "t-other" }),
    });

    const response = await POST(request as never) as unknown as { status: number };

    expect(response.status).toBe(400);
    expect(mockRequireProjectEditor).toHaveBeenCalledWith("u1", "MEMBER", "p1");
    expect(mockManual).not.toHaveBeenCalled();
  });

  it("runs a single distribution only after project and target checks", async () => {
    mockTargetFirst.mockResolvedValue({ id: "t1" });
    mockManual.mockResolvedValue({ success: true });
    const request = new Request("http://x/api/distribution", {
      method: "POST",
      body: JSON.stringify({ action: "single", draftId: "d1", targetId: "t1" }),
    });

    const response = await POST(request as never) as unknown as { status: number };

    expect(response.status).toBe(200);
    expect(mockTargetFirst).toHaveBeenCalledWith({
      where: { id: "t1", projectId: "p1", active: true },
      select: { id: true },
    });
    expect(mockManual).toHaveBeenCalledWith("d1", "t1");
  });

  it("authorizes target validation against the target project", async () => {
    mockTargetUnique.mockResolvedValue({ projectId: "p2" });
    mockValidate.mockResolvedValue({ valid: true });

    const response = await GET(new Request("http://x/api/distribution?targetId=t2") as never) as unknown as { status: number };

    expect(response.status).toBe(200);
    expect(mockRequireProjectEditor).toHaveBeenCalledWith("u1", "MEMBER", "p2");
    expect(mockValidate).toHaveBeenCalledWith("t2");
  });
});
