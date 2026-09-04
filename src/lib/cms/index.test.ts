import { describe, expect, it } from "vitest";
import { createCmsAdapter } from "./index";

describe("createCmsAdapter", () => {
  it("creates an isolated mock adapter", async () => {
    const adapter = createCmsAdapter({ type: "mock", baseUrl: "https://mock.invalid", apiKey: "" });
    const result = await adapter.createArticle({ title: "T", content: "C", status: "published" });
    expect(adapter.name).toBe("mock");
    expect(result.url).toContain("mock.example.com");
  });

  it("rejects unsupported integration types", () => {
    expect(() => createCmsAdapter({ type: "wordpress", baseUrl: "https://cms.test", apiKey: "x" }))
      .toThrow(/不支持/);
  });
});
