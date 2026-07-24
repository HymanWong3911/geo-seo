// LLM Provider + RealSearchProvider 注册中心测试。
// 2026-07-23 加 mock 和百炼 priority chain 测试(防止 chain 被改回去)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLLMProvider, providers } from "./index";
import { getSearchProvider, searchProviders } from "@/lib/search";

describe("LLM provider registry", () => {
  it("has all 8 providers registered", () => {
    expect(Object.keys(providers).sort()).toEqual(
      ["anthropic", "ark", "bailian", "custom_http", "google", "mock", "openai", "openai_compatible"].sort(),
    );
  });

  it("getLLMProvider returns requested provider", () => {
    const p = getLLMProvider("openai_compatible");
    expect(p.name).toBe("openai_compatible");
  });

  it("getLLMProvider defaults to env", () => {
    process.env.DEFAULT_LLM_PROVIDER = "openai";
    delete process.env.GEO_RUN_MOCK_LLM;
    delete process.env.BAILIAN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.GROK_BAILIAN_API_KEY;
    const p = getLLMProvider();
    expect(p.name).toBe("openai");
  });

  it("throws on unknown provider", () => {
    expect(() => getLLMProvider("nonexistent")).toThrow();
  });
});

// 2026-07-23: 优先级链测试 — 防止以后改 chain 把 mock/bailian 兜底绕过
describe("getLLMProvider priority chain", () => {
  let savedEnv: Record<string, string | undefined>;
  beforeEach(() => {
    savedEnv = {
      GEO_RUN_MOCK_LLM: process.env.GEO_RUN_MOCK_LLM,
      BAILIAN_API_KEY: process.env.BAILIAN_API_KEY,
      DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
      GROK_BAILIAN_API_KEY: process.env.GROK_BAILIAN_API_KEY,
      DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER,
    };
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("explicit name wins regardless of chain", () => {
    process.env.GEO_RUN_MOCK_LLM = "true";
    process.env.BAILIAN_API_KEY = "sk-bailian-real";
    expect(getLLMProvider("ark").name).toBe("ark");
  });

  it("GEO_RUN_MOCK_LLM=true → mock", () => {
    process.env.GEO_RUN_MOCK_LLM = "true";
    delete process.env.BAILIAN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.GROK_BAILIAN_API_KEY;
    expect(getLLMProvider().name).toBe("mock");
  });

  it("BAILIAN_API_KEY set → bailian (even if mock flag true? — 当前实现是 explicit 优先,但 mock flag 优先 bailian)", () => {
    process.env.GEO_RUN_MOCK_LLM = "true"; // mock 优先
    process.env.BAILIAN_API_KEY = "sk-bailian-real";
    expect(getLLMProvider().name).toBe("mock");
  });

  it("BAILIAN_API_KEY set,GEO_RUN_MOCK_LLM=false → bailian", () => {
    process.env.GEO_RUN_MOCK_LLM = "false";
    process.env.BAILIAN_API_KEY = "sk-bailian-real";
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.GROK_BAILIAN_API_KEY;
    expect(getLLMProvider().name).toBe("bailian");
  });

  it("GROK_BAILIAN_API_KEY set,GEO_RUN_MOCK_LLM=false → bailian (兼容用户 shell 命名)", () => {
    process.env.GEO_RUN_MOCK_LLM = "false";
    delete process.env.BAILIAN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    process.env.GROK_BAILIAN_API_KEY = "sk-sp-user-saved-style";
    expect(getLLMProvider().name).toBe("bailian");
  });

  it("no env set → fallback to DEFAULT/openai_compatible", () => {
    process.env.GEO_RUN_MOCK_LLM = "false";
    delete process.env.BAILIAN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.GROK_BAILIAN_API_KEY;
    delete process.env.DEFAULT_LLM_PROVIDER;
    expect(getLLMProvider().name).toBe("openai_compatible");
  });
});

describe("Search provider registry", () => {
  it("has all 5 search providers", () => {
    expect(Object.keys(searchProviders).sort()).toEqual(
      ["bailian", "doubao", "kimi", "llm_simulation", "perplexity"].sort(),
    );
  });

  it("getSearchProvider returns requested", () => {
    expect(getSearchProvider("perplexity").name).toBe("perplexity");
  });

  it("throws on unknown", () => {
    expect(() => getSearchProvider("xxx" as never)).toThrow();
  });
});
