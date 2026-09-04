import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProject = vi.fn();
const mockAvailableChannels = vi.fn();
const mockDefaultChannels = vi.fn();
const mockSearch = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { project: { findUnique: (...args: unknown[]) => mockProject(...args) } },
}));
vi.mock("@/lib/search", () => ({
  getAvailableChannels: (...args: unknown[]) => mockAvailableChannels(...args),
  getDefaultChannels: (...args: unknown[]) => mockDefaultChannels(...args),
  getSearchProvider: () => ({ search: (...args: unknown[]) => mockSearch(...args) }),
}));

import { runGeoQuestion } from "./channel";

describe("GEO result provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEO_FALLBACK_TO_LLM;
    delete process.env.GEO_RUN_MOCK_LLM;
    mockProject.mockResolvedValue({ id: "p1", geoChannels: [] });
    mockDefaultChannels.mockReturnValue(["bailian"]);
  });

  it("forces a synthetic llm_simulation result in explicit mock mode", async () => {
    process.env.GEO_RUN_MOCK_LLM = "true";
    mockAvailableChannels.mockReturnValue(["kimi", "llm_simulation"]);
    mockSearch.mockResolvedValue({
      answer: "mocked",
      citations: [],
      durationMs: 1,
      provenance: { kind: "llm-simulation", provider: "mock", synthetic: true },
    });

    const result = await runGeoQuestion("p1", "q1", "question", "zh-CN", "CN");

    expect(result.provider).toBe("llm_simulation");
    expect(result.attempts).toBe(1);
    expect(result.result.provenance).toEqual({
      kind: "llm-simulation",
      provider: "mock",
      synthetic: true,
      reason: "configured",
    });
    expect(mockAvailableChannels).not.toHaveBeenCalled();
  });

  it("marks no-channel LLM fallback as synthetic", async () => {
    mockAvailableChannels.mockReturnValue([]);
    mockSearch.mockResolvedValue({
      answer: "simulated",
      citations: [],
      durationMs: 1,
      provenance: { kind: "llm-simulation", provider: "mock", synthetic: true },
    });

    const result = await runGeoQuestion("p1", "q1", "question", "zh-CN", "CN");

    expect(result.provider).toBe("llm_simulation");
    expect(result.result.provenance).toMatchObject({
      kind: "llm-simulation",
      synthetic: true,
      reason: "no-channel",
    });
  });

  it("marks configured search-channel results as real", async () => {
    mockAvailableChannels.mockReturnValue(["bailian"]);
    mockSearch.mockResolvedValue({ answer: "real", citations: ["https://source.test"], durationMs: 1 });

    const result = await runGeoQuestion("p1", "q1", "question", "zh-CN", "CN");

    expect(result.provider).toBe("bailian");
    expect(result.result.provenance).toEqual({
      kind: "real-search",
      provider: "bailian",
      synthetic: false,
      reason: "configured",
    });
  });
});
