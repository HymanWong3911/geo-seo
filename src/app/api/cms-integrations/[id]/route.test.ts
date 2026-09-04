import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockCount = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockRequireAdmin = vi.fn();
const mockAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cmsIntegration: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    publishLog: { count: (...args: unknown[]) => mockCount(...args) },
  },
}));
vi.mock("@/lib/api/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));
vi.mock("@/lib/audit/logger", () => ({
  audit: (...args: unknown[]) => mockAudit(...args),
}));

import { DELETE } from "./route";

describe("DELETE /api/cms-integrations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockFindUnique.mockResolvedValue({ id: "cms-1", name: "Primary CMS" });
    mockCount.mockResolvedValue(0);
    mockUpdate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
    mockAudit.mockResolvedValue(undefined);
  });

  it("deletes an unused integration", async () => {
    const response = await DELETE(new Request("http://x") as never, {
      params: { id: "cms-1" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { ok: true, archived: false },
    });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "cms-1" } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("archives an integration that has immutable publish history", async () => {
    mockCount.mockResolvedValue(3);

    const response = await DELETE(new Request("http://x") as never, {
      params: { id: "cms-1" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { ok: true, archived: true },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "cms-1" },
      data: { active: false },
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
