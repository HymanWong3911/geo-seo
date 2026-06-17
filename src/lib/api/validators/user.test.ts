import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  resetPasswordByEmailSchema,
} from "./user";

describe("createUserSchema", () => {
  it("accepts valid input", () => {
    const r = createUserSchema.safeParse({
      email: "a@b.com",
      name: "Test",
      role: "ADMIN",
    });
    expect(r.success).toBe(true);
  });

  it("rejects bad email", () => {
    const r = createUserSchema.safeParse({ email: "not-email", name: "Test" });
    expect(r.success).toBe(false);
  });

  it("defaults role to MEMBER", () => {
    const r = createUserSchema.safeParse({ email: "a@b.com", name: "Test" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("MEMBER");
  });
});

describe("changePasswordSchema", () => {
  it("requires newPassword >= 8", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
    });
    expect(r.success).toBe(false);
  });
});

describe("resetPasswordByEmailSchema", () => {
  it("requires valid email", () => {
    const r = resetPasswordByEmailSchema.safeParse({ email: "x" });
    expect(r.success).toBe(false);
  });
});
