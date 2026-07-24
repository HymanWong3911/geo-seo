// MockLLMProvider 单元测试。
// 2026-07-23:为防 mock provider 行为退化加测试。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockLLMProvider } from "./mock";

describe("MockLLMProvider", () => {
  let savedEnv: Record<string, string | undefined>;
  beforeEach(() => {
    savedEnv = { MOCK_DEFAULT_BRAND: process.env.MOCK_DEFAULT_BRAND };
  });
  afterEach(() => {
    if (savedEnv.MOCK_DEFAULT_BRAND === undefined) delete process.env.MOCK_DEFAULT_BRAND;
    else process.env.MOCK_DEFAULT_BRAND = savedEnv.MOCK_DEFAULT_BRAND;
  });

  it("provider name is 'mock'", () => {
    const llm = new MockLLMProvider();
    expect(llm.name).toBe("mock");
  });

  it("estimateCost is always 0", () => {
    const llm = new MockLLMProvider();
    expect(llm.estimateCost({ prompt: "abc" })).toBe(0);
  });

  describe("completeWithUsage (analysis call)", () => {
    it("extracts primary brand from prompt pattern 主品牌:{name}", async () => {
      const llm = new MockLLMProvider();
      // worker 用全角冒号「:」(U+FF1A)渲染的 prompt,匹配 `主品牌：xxx`
      const result = await llm.completeWithUsage({
        system: "你只输出合法 JSON,不要包含任何额外文字或 markdown 标记。",
        prompt: "主品牌：森田连锁咨询\n品牌别名：森田100, 森田咨询\n竞品：竞品连锁咨询A\n",
      });
      const parsed = JSON.parse(result.content);
      expect(parsed.primaryBrandMentioned).toBe(true);
      expect(parsed.mentionedBrands).toEqual(["森田连锁咨询"]);
      expect(parsed.mentionedCompetitors).toEqual(["竞品连锁咨询A"]);
      expect(parsed.summary).toContain("森田连锁咨询");
    });

    it("falls back to MOCK_DEFAULT_BRAND env when prompt 没有主品牌行", async () => {
      process.env.MOCK_DEFAULT_BRAND = "森田100";
      const llm = new MockLLMProvider();
      const result = await llm.completeWithUsage({
        system: "你只输出合法 JSON",
        prompt: "没有任何品牌名",
      });
      const parsed = JSON.parse(result.content);
      expect(parsed.mentionedBrands).toEqual(["森田100"]);
    });

    it("falls back to hardcoded default when env 和 prompt 都没有品牌", async () => {
      delete process.env.MOCK_DEFAULT_BRAND;
      const llm = new MockLLMProvider();
      const result = await llm.completeWithUsage({
        system: "你只输出合法 JSON",
        prompt: "no brand here",
      });
      const parsed = JSON.parse(result.content);
      expect(parsed.mentionedBrands.length).toBe(1);
      expect(parsed.mentionedBrands[0].length).toBeGreaterThan(0);
    });

    it("returns valid JSON (parseable)", async () => {
      const llm = new MockLLMProvider();
      const result = await llm.completeWithUsage({
        system: "你只输出合法 JSON,不要包含任何额外文字或 markdown 标记。",
        prompt: "主品牌：Acme\n",  // 全角冒号
      });
      expect(() => JSON.parse(result.content)).not.toThrow();
    });

    it("respects 'JSON' marker in system to differentiate from search", async () => {
      const llm = new MockLLMProvider();
      const analysisResult = await llm.completeWithUsage({
        system: "返回 JSON",
        prompt: "主品牌：TestBrand\n",  // 全角冒号
      });
      expect(() => JSON.parse(analysisResult.content)).not.toThrow();

      const searchResult = await llm.completeWithUsage({
        system: "你是 SEO 搜索引擎",
        prompt: "主品牌：TestBrand\n",
      });
      expect(() => JSON.parse(searchResult.content)).toThrow();
      expect(searchResult.content).toContain("TestBrand");
    });
  });

  describe("completeWithUsage (search call)", () => {
    it("returns Chinese answer referencing brand when language=zh", async () => {
      const llm = new MockLLMProvider();
      const result = await llm.completeWithUsage({
        // 含 "zh" 触发中文分支(参考 mock.ts 语言检测 `prompt.includes("zh")`)
        prompt: "语言：zh-CN\n主品牌：森田连锁咨询\n地区:CN",
      });
      expect(result.content).toContain("森田连锁咨询");
      expect(result.content).toMatch(/搜索引擎|根据|适合/);
    });

    it("returns English answer when prompt has no zh", async () => {
      const llm = new MockLLMProvider();
      // prompt 是英文 → 用全角冒号但 prompt 里也没"zh",所以给 en-US
      const result = await llm.completeWithUsage({
        prompt: "Question: please answer about the brand:主品牌：Acme Corp\n",
      });
      expect(result.content).toContain("Acme Corp");
      expect(result.content).toMatch(/According to public/i);
    });

    it("uses MOCK_DEFAULT_BRAND env when prompt 没有任何品牌", async () => {
      process.env.MOCK_DEFAULT_BRAND = "DefaultCo";
      const llm = new MockLLMProvider();
      const result = await llm.completeWithUsage({
        prompt: "no brand mentioned here",
      });
      expect(result.content).toContain("DefaultCo");
    });
  });

  it("usage tokens count is non-negative", async () => {
    const llm = new MockLLMProvider();
    const result = await llm.completeWithUsage({
      prompt: "hello world",
    });
    expect(result.usage?.promptTokens).toBeGreaterThanOrEqual(0);
    expect(result.usage?.completionTokens).toBeGreaterThanOrEqual(0);
  });
});
