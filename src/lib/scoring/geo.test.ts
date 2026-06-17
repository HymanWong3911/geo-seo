// GEO 评分计算单元测试。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    geoRunResult: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    project: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

import { calculateProjectGeoMetrics } from "./geo";

describe("calculateProjectGeoMetrics", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
  });

  it("returns 0 score when no data", async () => {
    mockFindMany.mockResolvedValue([]);
    mockFindUnique.mockResolvedValue({
      id: "p1",
      domain: "example.com",
      primaryBrand: "Acme",
      brands: [{ name: "Acme" }],
    });
    const m = await calculateProjectGeoMetrics("p1");
    // 无数据时，calculateScore 中 totalQuestions === 0 直接返回 0
    expect(m.score).toBe(0);
    expect(m.brandMentioned).toBe(0);
  });

  it("computes high score when brand well-mentioned", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        // recent 7 days
        {
          primaryBrandMentioned: true,
          primaryBrandRecommended: true,
          citedUrls: ["https://example.com/"],
          mentionedCompetitors: [],
        },
        {
          primaryBrandMentioned: true,
          primaryBrandRecommended: true,
          citedUrls: ["https://example.com/2"],
          mentionedCompetitors: [],
        },
        {
          primaryBrandMentioned: true,
          primaryBrandRecommended: false,
          citedUrls: [],
          mentionedCompetitors: [],
        },
      ])
      .mockResolvedValueOnce([]);
    mockFindUnique.mockResolvedValue({
      id: "p1",
      domain: "example.com",
      primaryBrand: "Acme",
      brands: [{ name: "Acme" }],
    });
    const m = await calculateProjectGeoMetrics("p1");
    expect(m.brandMentioned).toBe(3);
    expect(m.brandRecommended).toBe(2);
    expect(m.officialLink).toBe(2);
    expect(m.score).toBeGreaterThan(80);
  });
});
