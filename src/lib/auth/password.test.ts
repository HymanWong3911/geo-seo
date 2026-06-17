import { describe, it, expect } from "vitest";
import { validatePassword, generateRandomPassword } from "./password";

describe("validatePassword", () => {
  it("rejects too short", () => {
    const r = validatePassword("Abc1");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("8 位"))).toBe(true);
  });

  it("rejects missing uppercase", () => {
    const r = validatePassword("abcdefg1");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("大写"))).toBe(true);
  });

  it("rejects missing lowercase", () => {
    const r = validatePassword("ABCDEFG1");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("小写"))).toBe(true);
  });

  it("rejects missing digit", () => {
    const r = validatePassword("Abcdefgh");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("数字"))).toBe(true);
  });

  it("rejects common weak passwords", () => {
    const r = validatePassword("Password");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("常见"))).toBe(true);
  });

  it("accepts a strong password", () => {
    const r = validatePassword("GeoSeo@2026");
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
});

describe("generateRandomPassword", () => {
  it("returns 16-character alphanumeric", () => {
    const pw = generateRandomPassword();
    expect(pw).toHaveLength(16);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates different values each time", () => {
    const a = generateRandomPassword();
    const b = generateRandomPassword();
    expect(a).not.toBe(b);
  });
});
