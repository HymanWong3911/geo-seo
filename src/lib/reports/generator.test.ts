// 报告生成器单元测试。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockGroupBy = vi.fn();
const mockAggregate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    pageAudit: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    optimizationTask: {
      count: (...args: unknown[]) => mockCount(...args),
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
    llmCall: { aggregate: (...args: unknown[]) => mockAggregate(...args) },
  },
}));

import { generateWeeklyReport, generateMonthlyReport, generateAuditReport } from "./generator";

describe("generateWeeklyReport", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockAggregate.mockReset();
  });

  it("returns markdown with project name and metrics", async () => {
    mockFindUnique.mockResolvedValue({ id: "p1", name: "测试项目" });
    mockFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockCount.mockResolvedValue(0);
    mockAggregate.mockResolvedValue({ _sum: { costCents: 0, totalTokens: 0 } });

    const md = await generateWeeklyReport("p1");
    expect(md).toContain("# 测试项目 - 周报");
    expect(md).toContain("## 1. 本期总览");
    expect(md).toContain("## 6. 下周建议");
  });

  it("throws on missing project", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(generateWeeklyReport("missing")).rejects.toThrow("项目不存在");
  });
});

describe("generateAuditReport", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("formats audit details as markdown", async () => {
    mockFindUnique.mockResolvedValue({
      id: "a1",
      score: 75,
      createdAt: new Date(),
      findings: [
        { code: "MISSING_TITLE", severity: "high", title: "缺 title", description: "", recommendation: "加 title" },
      ],
      rawSnapshot: {
        title: "页标题",
        description: "desc",
        h1: "h1",
        wordCount: 500,
        internalLinkCount: 3,
        externalLinkCount: 1,
        imageCount: 2,
        imageWithAltCount: 2,
        hasCanonical: true,
        hasSchema: false,
        hasOpenGraph: false,
        performance: { ttfb: 200, fcp: 1000, lcp: 2000, tbt: 100 },
      },
      page: {
        url: "https://example.com",
        project: { name: "项目" },
      },
    });

    const md = await generateAuditReport("a1");
    expect(md).toContain("# 页标题 - 诊断报告");
    expect(md).toContain("**75 / 100**");
    expect(md).toContain("MISSING_TITLE");
    expect(md).toContain("high（1 项）");
  });
});
