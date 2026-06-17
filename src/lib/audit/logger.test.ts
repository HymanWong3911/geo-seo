import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const mockCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

import { audit } from "./logger";

describe("audit", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("writes audit log with all fields", async () => {
    mockCreate.mockResolvedValue({ id: "audit_1" });
    await audit("USER_LOGIN", {
      userId: "user_1",
      targetType: "User",
      targetId: "user_1",
      metadata: { provider: "credentials" },
      ip: "127.0.0.1",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        action: "USER_LOGIN",
        targetType: "User",
        targetId: "user_1",
        metadata: { provider: "credentials" },
        ip: "127.0.0.1",
        userAgent: null,
      },
    });
  });

  it("handles missing fields gracefully", async () => {
    mockCreate.mockResolvedValue({ id: "audit_2" });
    await audit("USER_LOGOUT");

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: "USER_LOGOUT",
        targetType: null,
        targetId: null,
        metadata: undefined,
        ip: null,
        userAgent: null,
      },
    });
  });

  it("does not throw when prisma fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("db down"));

    // Should not throw
    await expect(audit("USER_LOGIN_FAILED")).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
