// LLM Provider + RealSearchProvider 注册中心测试。
import { describe, it, expect } from "vitest";
import { getLLMProvider, providers } from "./index";
import { getSearchProvider, searchProviders } from "@/lib/search";

describe("LLM provider registry", () => {
  it("has all 6 providers registered", () => {
    expect(Object.keys(providers).sort()).toEqual(
      ["anthropic", "ark", "custom_http", "google", "openai", "openai_compatible"].sort(),
    );
  });

  it("getLLMProvider returns requested provider", () => {
    const p = getLLMProvider("openai_compatible");
    expect(p.name).toBe("openai_compatible");
  });

  it("getLLMProvider defaults to env", () => {
    process.env.DEFAULT_LLM_PROVIDER = "openai";
    const p = getLLMProvider();
    expect(p.name).toBe("openai");
  });

  it("throws on unknown provider", () => {
    expect(() => getLLMProvider("nonexistent")).toThrow();
  });
});

describe("Search provider registry", () => {
  it("has 4 search providers", () => {
    expect(Object.keys(searchProviders).sort()).toEqual(
      ["doubao", "kimi", "llm_simulation", "perplexity"].sort(),
    );
  });

  it("getSearchProvider returns requested", () => {
    expect(getSearchProvider("perplexity").name).toBe("perplexity");
  });

  it("throws on unknown", () => {
    expect(() => getSearchProvider("xxx" as never)).toThrow();
  });
});
