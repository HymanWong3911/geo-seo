import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMembership = vi.fn();
const mockProjectList = vi.fn();
const mockDraft = vi.fn();
const mockAudit = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    userProject: {
      findUnique: (...args: unknown[]) => mockMembership(...args),
      findMany: vi.fn(),
    },
    project: { findMany: (...args: unknown[]) => mockProjectList(...args), findUnique: vi.fn() },
    optimizationTask: { findUnique: vi.fn() },
    contentDraft: { findUnique: (...args: unknown[]) => mockDraft(...args) },
    pageAudit: { findUnique: (...args: unknown[]) => mockAudit(...args) },
    geoRun: { findUnique: vi.fn() },
  },
}));

import {
  requireProjectMember,
  resolveAccessibleProjectIds,
  resolveTargetProjectId,
} from "./auth";

describe("project access helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a requested project when MEMBER has no membership", async () => {
    mockMembership.mockResolvedValue(null);

    await expect(resolveAccessibleProjectIds("u1", "MEMBER", "p-private")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("allows VIEWER membership for read access", async () => {
    mockMembership.mockResolvedValue({ role: "VIEWER" });

    await expect(requireProjectMember("u1", "MEMBER", "p1")).resolves.toEqual({ role: "VIEWER" });
  });

  it("scopes ADMIN cross-project views to active projects", async () => {
    mockProjectList.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

    await expect(resolveAccessibleProjectIds("admin", "ADMIN")).resolves.toEqual(["p1", "p2"]);
    expect(mockProjectList).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
  });

  it("resolves a ContentDraft target to its owning project", async () => {
    mockDraft.mockResolvedValue({ projectId: "p1" });

    await expect(resolveTargetProjectId("ContentDraft", "d1")).resolves.toBe("p1");
  });

  it("rejects unsupported collaboration target types", async () => {
    await expect(resolveTargetProjectId("Unknown", "x1")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });
});
