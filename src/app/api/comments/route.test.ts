import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.fn();
const mockResolveTargetProjectId = vi.fn();
const mockRequireProjectMember = vi.fn();
const mockRequireProjectEditor = vi.fn();
const mockCommentFindMany = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
  resolveTargetProjectId: (...args: unknown[]) => mockResolveTargetProjectId(...args),
  requireProjectMember: (...args: unknown[]) => mockRequireProjectMember(...args),
  requireProjectEditor: (...args: unknown[]) => mockRequireProjectEditor(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    comment: { findMany: (...args: unknown[]) => mockCommentFindMany(...args), findUnique: vi.fn(), create: vi.fn() },
    user: { count: vi.fn() },
  },
}));
vi.mock("@/lib/audit/logger", () => ({ audit: vi.fn() }));
vi.mock("@/lib/notification/sender", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/api/response", () => ({
  Errors: {
    badRequest: () => Object.assign(new Error(), { status: 400 }),
  },
  handleError: (error: unknown) => ({ status: (error as { status?: number }).status ?? 500 }),
  success: (data: unknown) => ({ status: 200, body: { data } }),
  created: (data: unknown) => ({ status: 201, body: { data } }),
}));

import { GET } from "./route";

describe("/api/comments target authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "MEMBER" } });
    mockResolveTargetProjectId.mockResolvedValue("p1");
    mockCommentFindMany.mockResolvedValue([]);
  });

  it("checks project membership before returning target comments", async () => {
    mockRequireProjectMember.mockResolvedValue({ role: "VIEWER" });

    const response = await GET(new Request("http://x/api/comments?targetType=ContentDraft&targetId=d1") as never) as unknown as { status: number };

    expect(response.status).toBe(200);
    expect(mockResolveTargetProjectId).toHaveBeenCalledWith("ContentDraft", "d1");
    expect(mockRequireProjectMember).toHaveBeenCalledWith("u1", "MEMBER", "p1");
    expect(mockCommentFindMany).toHaveBeenCalledTimes(1);
  });

  it("does not query comments when membership is denied", async () => {
    mockRequireProjectMember.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));

    const response = await GET(new Request("http://x/api/comments?targetType=ContentDraft&targetId=d1") as never) as unknown as { status: number };

    expect(response.status).toBe(403);
    expect(mockCommentFindMany).not.toHaveBeenCalled();
  });
});
