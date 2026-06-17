import { describe, it, expect } from "vitest";
import { createKeywordSchema, updateKeywordSchema } from "./keyword";

describe("createKeywordSchema", () => {
  it("accepts valid minimal input", () => {
    const r = createKeywordSchema.safeParse({ text: "SEO 优化" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.intent).toBe("INFORMATIONAL");
      expect(r.data.priority).toBe(3);
      expect(r.data.language).toBe("zh-CN");
    }
  });

  it("rejects empty text", () => {
    const r = createKeywordSchema.safeParse({ text: "" });
    expect(r.success).toBe(false);
  });

  it("rejects bad intent", () => {
    const r = createKeywordSchema.safeParse({ text: "x", intent: "BOGUS" });
    expect(r.success).toBe(false);
  });

  it("clamps priority to 1-5", () => {
    expect(createKeywordSchema.safeParse({ text: "x", priority: 0 }).success).toBe(false);
    expect(createKeywordSchema.safeParse({ text: "x", priority: 6 }).success).toBe(false);
    expect(createKeywordSchema.safeParse({ text: "x", priority: 3 }).success).toBe(true);
  });
});

describe("updateKeywordSchema", () => {
  it("accepts partial", () => {
    const r = updateKeywordSchema.safeParse({ priority: 1 });
    expect(r.success).toBe(true);
  });
});
