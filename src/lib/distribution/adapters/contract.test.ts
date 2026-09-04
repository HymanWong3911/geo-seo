import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdapter } from "./index";

const input = {
  title: "GEO article",
  content: "content",
  excerpt: "excerpt",
};

describe("distribution adapter outbound contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DISTRIBUTION_WEBHOOK_ALLOW_PRIVATE_HOSTS;
  });

  it("blocks custom webhooks targeting link-local metadata services", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await getAdapter("CUSTOM_WEBHOOK")!.distribute({
      url: "https://169.254.169.254/latest/meta-data",
    }, input);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/私有或保留/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("applies an abort deadline to fixed external adapters", async () => {
    const mockFetch = vi.fn().mockImplementation((_url: URL, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(new Response(JSON.stringify({ id: "article-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await getAdapter("ZHIHU")!.distribute({ token: "secret" }, input);

    expect(result).toMatchObject({ success: true, externalId: "article-1" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("signs custom webhook payloads without exposing the shared secret", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "delivery-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await getAdapter("CUSTOM_WEBHOOK")!.distribute({
      url: "https://8.8.8.8/hook",
      secret: "do-not-leak-this-secret",
    }, input);

    expect(result.success).toBe(true);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-Signature")).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers.get("X-Signature")).not.toContain("do-not-leak-this-secret");
    expect(headers.get("X-Timestamp")).toMatch(/^\d+$/);
  });
});
