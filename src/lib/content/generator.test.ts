// 内容生成器 / 改写器 / 关键词扩展器 单测。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockComplete = vi.fn();
vi.mock("@/lib/llm", () => ({
  getLLMProvider: () => ({ complete: mockComplete, name: "test" }),
}));

import { generateContent } from "./generator";
import { rewriteContent } from "./rewriter";
import { expandKeywords } from "@/lib/keyword/expander";

describe("generateContent", () => {
  beforeEach(() => mockComplete.mockReset());

  it("returns structured content", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({
      title: "T",
      content: "C",
      excerpt: "E",
      metaTitle: "MT",
      metaDescription: "MD",
      outline: ["a", "b"],
      faq: [{ question: "q", answer: "a" }],
      tags: ["t1"],
    }));

    const r = await generateContent({
      topic: "SEO",
      targetKeywords: ["k1"],
      brandName: "Acme",
    });

    expect(r.title).toBe("T");
    expect(r.outline).toEqual(["a", "b"]);
  });

  it("recovers from LLM wrapping JSON in markdown fences", async () => {
    mockComplete.mockResolvedValue("```json\n" + JSON.stringify({
      title: "T", content: "C", excerpt: "E", metaTitle: "MT", metaDescription: "MD",
      outline: [], faq: [], tags: [],
    }) + "\n```");

    const r = await generateContent({ topic: "x", targetKeywords: ["k"], brandName: "B" });
    expect(r.title).toBe("T");
  });
});

describe("rewriteContent", () => {
  beforeEach(() => mockComplete.mockReset());

  it("returns diff segments", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({
      rewritten: "Hello world",
      appliedFindingCodes: ["MISSING_TITLE"],
    }));

    const r = await rewriteContent({
      originalContent: "Hello there",
      findings: [
        { code: "MISSING_TITLE", severity: "high", title: "缺 title", description: "", recommendation: "" },
      ],
      targetKeywords: [],
    });

    expect(r.appliedFindingCodes).toEqual(["MISSING_TITLE"]);
    expect(r.diff.length).toBeGreaterThan(0);
    expect(r.diff.some((d) => d.type === "removed")).toBe(true);
    expect(r.diff.some((d) => d.type === "added")).toBe(true);
  });
});

describe("expandKeywords", () => {
  beforeEach(() => mockComplete.mockReset());

  it("returns expanded keyword list", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({
      suggestions: [
        { text: "如何选 SEO 工具", searchVolume: 100, difficulty: 30, intent: "COMMERCIAL" },
        { text: "SEO 工具对比", searchVolume: 200, difficulty: 50, intent: "COMPARISON" },
      ],
    }));

    const r = await expandKeywords({ seedKeyword: "SEO 工具" });
    expect(r).toHaveLength(2);
    expect(r[0].intent).toBe("COMMERCIAL");
  });
});
