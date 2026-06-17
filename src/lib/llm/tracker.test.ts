// LLM 调用追踪单元测试。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    llmCall: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

import { trackLLMCall } from "./tracker";

describe("trackLLMCall", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("records successful call with cost estimate", async () => {
    mockCreate.mockResolvedValue({ id: "lc_1" });
    const result = await trackLLMCall(
      { jobType: "llm-fallback", provider: "openai_compatible", model: "MiniMax-M3" },
      async () => "回答内容 ".repeat(100),  // ~500 chars
    );
    expect(result.length).toBeGreaterThan(0);

    // 等异步写库
    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreate).toHaveBeenCalled();
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.jobType).toBe("llm-fallback");
    expect(call.data.success).toBe(true);
    expect(call.data.provider).toBe("openai_compatible");
    expect(call.data.costCents).toBeGreaterThan(0);
  });

  it("records failed call and rethrows error", async () => {
    mockCreate.mockResolvedValue({ id: "lc_2" });
    await expect(
      trackLLMCall(
        { jobType: "geo-analysis", provider: "x", model: "y" },
        async () => {
          throw new Error("API timeout");
        },
      ),
    ).rejects.toThrow("API timeout");

    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreate).toHaveBeenCalled();
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.success).toBe(false);
    expect(call.data.errorMessage).toBe("API timeout");
  });

  it("does not block main flow when DB write fails", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));
    const result = await trackLLMCall(
      { jobType: "draft-generate", provider: "x", model: "y" },
      async () => "ok",
    );
    expect(result).toBe("ok");

    await new Promise((r) => setTimeout(r, 10));
    // 主流程不受影响
    expect(result).toBe("ok");
  });
});
