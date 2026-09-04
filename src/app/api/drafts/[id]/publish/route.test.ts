import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDraft = vi.fn();
const mockIntegration = vi.fn();
const mockRequireSession = vi.fn();
const mockRequireProjectEditor = vi.fn();
const mockEnqueue = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    contentDraft: { findUnique: (...args: unknown[]) => mockDraft(...args) },
    cmsIntegration: { findUnique: (...args: unknown[]) => mockIntegration(...args) },
  },
}));
vi.mock("@/lib/api/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  requireProjectEditor: (...args: unknown[]) => mockRequireProjectEditor(...args),
}));
vi.mock("@/lib/queue/cms", () => ({
  enqueueCmsPublish: (...args: unknown[]) => mockEnqueue(...args),
}));

import { POST } from "./route";

function request() {
  return new Request("http://x/api/drafts/d1/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ integrationId: "cms1" }),
  });
}

describe("POST /api/drafts/[id]/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    mockRequireProjectEditor.mockResolvedValue({ role: "EDITOR" });
    mockDraft.mockResolvedValue({ id: "d1", projectId: "p1", status: "APPROVED", publishLog: null });
    mockIntegration.mockResolvedValue({ id: "cms1", projectId: "p1", active: true });
    mockEnqueue.mockResolvedValue({ id: "job-1" });
  });

  it("queues an approved draft after project authorization", async () => {
    const response = await POST(request() as never, { params: { id: "d1" } });
    expect(response.status).toBe(202);
    expect(mockRequireProjectEditor).toHaveBeenCalledWith("u1", "MEMBER", "p1");
    expect(mockEnqueue).toHaveBeenCalledWith({ draftId: "d1", integrationId: "cms1", userId: "u1" });
  });

  it("rejects cross-project integrations", async () => {
    mockIntegration.mockResolvedValue({ id: "cms1", projectId: "p2", active: true });
    const response = await POST(request() as never, { params: { id: "d1" } });
    expect(response.status).toBe(404);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("rejects drafts that are not approved", async () => {
    mockDraft.mockResolvedValue({ id: "d1", projectId: "p1", status: "DRAFT", publishLog: null });
    const response = await POST(request() as never, { params: { id: "d1" } });
    expect(response.status).toBe(409);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
