import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeOutboundUrl,
  isPrivateOrReservedIp,
  outboundFetch,
  parseHostAllowlist,
} from "./outbound";

describe("outbound URL policy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("classifies private, link-local and documentation ranges", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.2.3.4")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });

  it("rejects localhost and DNS answers that resolve to private addresses", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1/admin", { allowHttp: true })).rejects.toThrow(/私有或保留/);
    await expect(assertSafeOutboundUrl("https://webhook.example.test", {
      lookupAddresses: async () => ["10.0.0.5"],
    })).rejects.toThrow(/私有或保留/);
  });

  it("enforces exact and wildcard host allowlists", async () => {
    const policy = {
      allowedHosts: parseHostAllowlist("hooks.example.com,*.trusted.test"),
      lookupAddresses: async () => ["8.8.8.8"],
    };
    await expect(assertSafeOutboundUrl("https://hooks.example.com/a", policy)).resolves.toBeInstanceOf(URL);
    await expect(assertSafeOutboundUrl("https://a.trusted.test/a", policy)).resolves.toBeInstanceOf(URL);
    await expect(assertSafeOutboundUrl("https://evil.test/a", policy)).rejects.toThrow(/允许列表/);
  });

  it("retries transient GET failures but does not retry POST by default", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const response = await outboundFetch("https://api.example.com/status", {}, {
      retryDelayMs: 1,
    });
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockReset().mockResolvedValue(new Response("busy", { status: 503 }));
    const postResponse = await outboundFetch("https://api.example.com/publish", { method: "POST" });
    expect(postResponse.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("validates redirect targets before following them", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data" },
    }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(outboundFetch("https://public.example.test/start", {}, {
      validateUrl: true,
      allowHttp: true,
      maxRedirects: 2,
      lookupAddresses: async () => ["8.8.8.8"],
    })).rejects.toThrow(/私有或保留/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
