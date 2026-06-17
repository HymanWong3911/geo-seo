import { describe, it, expect } from "vitest";
import {
  createGeoQuestionSchema,
  createBrandSchema,
  createCompetitorSchema,
} from "./geo";

describe("createGeoQuestionSchema", () => {
  it("accepts valid", () => {
    const r = createGeoQuestionSchema.safeParse({
      question: "最好的 SEO 工具有哪些？",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.active).toBe(true);
      expect(r.data.keywordIds).toEqual([]);
    }
  });

  it("rejects empty question", () => {
    const r = createGeoQuestionSchema.safeParse({ question: "" });
    expect(r.success).toBe(false);
  });
});

describe("createBrandSchema", () => {
  it("accepts minimal", () => {
    const r = createBrandSchema.safeParse({ name: "Acme" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.aliases).toEqual([]);
      expect(r.data.products).toEqual([]);
      expect(r.data.isPrimary).toBe(false);
    }
  });

  it("rejects empty name", () => {
    expect(createBrandSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("createCompetitorSchema", () => {
  it("accepts minimal", () => {
    const r = createCompetitorSchema.safeParse({ name: "竞品A" });
    expect(r.success).toBe(true);
  });
});
