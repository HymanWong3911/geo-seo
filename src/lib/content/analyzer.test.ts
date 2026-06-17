// 内容分析器测试（mock LLM + mock crawler）。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockComplete = vi.fn();
const mockCrawl = vi.fn();
vi.mock("@/lib/llm", () => ({
  getLLMProvider: () => ({ complete: mockComplete, name: "test" }),
}));
vi.mock("@/lib/crawler", () => ({
  crawlPage: (...args: unknown[]) => mockCrawl(...args),
}));

import { analyzeContent } from "./analyzer";

describe("analyzeContent", () => {
  beforeEach(() => {
    mockComplete.mockReset();
    mockCrawl.mockReset();
  });

  it("requires url or content", async () => {
    await expect(
      analyzeContent({
        projectId: "p1",
        targetKeywords: ["k1"],
        brandName: "Acme",
      } as never),
    ).rejects.toThrow("必须提供 url 或 content 之一");
  });

  it("analyzes URL via crawler and returns suggestions", async () => {
    mockCrawl.mockResolvedValue({
      url: "https://example.com",
      finalUrl: "https://example.com",
      statusCode: 200,
      html: `<!doctype html><html><head><title>Test</title><meta name="description" content="d"></head><body><h1>H1</h1><p>${"content ".repeat(50)}</p></body></html>`,
      performance: { ttfb: 100, fcp: null, lcp: null, tbt: 0 },
      method: "fetch",
    });

    mockComplete.mockResolvedValue(JSON.stringify({
      titleSuggestions: ["改进的标题"],
      descriptionSuggestions: ["改进的描述"],
      headingSuggestions: ["新 H2"],
      keywordGaps: ["k2"],
      internalLinkSuggestions: ["link to /about"],
      schemaSuggestions: ["FAQPage"],
      improvements: ["improve content"],
      definitionParagraph: "这是定义段",
      faqSuggestions: [{ question: "Q", answer: "A" }],
      comparisonTable: "| a | b |",
      citableSnippets: ["可引用段"],
      brandMentionsToAdd: ["品牌事实1"],
      missedOpportunities: ["机会1"],
      improvements_geo: ["改进"],
      taskSuggestions: [
        { title: "T1", description: "D1", priority: 1, source: "SEO" },
        { title: "T2", description: "D2", priority: 2, source: "GEO" },
      ],
    }));

    const r = await analyzeContent({
      url: "https://example.com",
      projectId: "p1",
      targetKeywords: ["k1"],
      brandName: "Acme",
    });

    expect(r.url).toBe("https://example.com");
    expect(r.title).toBe("Test");
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.seoSuggestions.titleSuggestions).toEqual(["改进的标题"]);
    expect(r.geoSuggestions.faqSuggestions).toHaveLength(1);
    expect(r.taskSuggestions).toHaveLength(2);
    expect(r.taskSuggestions[0].source).toBe("SEO");
  });

  it("uses raw text when content provided", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({
      titleSuggestions: [], descriptionSuggestions: [], headingSuggestions: [],
      keywordGaps: [], internalLinkSuggestions: [], schemaSuggestions: [], improvements: [],
      definitionParagraph: "", faqSuggestions: [], comparisonTable: "",
      citableSnippets: [], brandMentionsToAdd: [], missedOpportunities: [],
      improvements_geo: [], taskSuggestions: [],
    }));

    const r = await analyzeContent({
      content: "这是一段正文内容，至少五十字，所以这里要写长一点。",
      contentFormat: "text",
      projectId: "p1",
      targetKeywords: ["k1"],
      brandName: "Acme",
    });

    expect(r.url).toBeUndefined();
    expect(r.wordCount).toBeGreaterThan(0);
  });
});
