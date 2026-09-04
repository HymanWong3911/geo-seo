import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

type LookupAddresses = (hostname: string) => Promise<string[]>;

export interface OutboundUrlPolicy {
  allowHttp?: boolean;
  allowPrivate?: boolean;
  allowedHosts?: string[];
  lookupAddresses?: LookupAddresses;
}

export interface OutboundFetchPolicy extends OutboundUrlPolicy {
  timeoutMs?: number;
  attempts?: number;
  retryDelayMs?: number;
  validateUrl?: boolean;
  maxRedirects?: number;
}

export function parseHostAllowlist(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAllowedHost(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const normalized = pattern.toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(2);
    return host.endsWith(`.${suffix}`) && host !== suffix;
  }
  return host === normalized;
}

export function isPrivateOrReservedIp(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  const version = isIP(normalized);
  if (version === 4) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && parts[2] === 2)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && parts[2] === 100)
      || (a === 203 && b === 0 && parts[2] === 113)
      || a >= 224;
  }
  if (version === 6) {
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateOrReservedIp(mapped[1]) : false;
  }
  return true;
}

async function defaultLookupAddresses(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export async function assertSafeOutboundUrl(
  value: string | URL,
  policy: OutboundUrlPolicy = {},
): Promise<URL> {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value);
  } catch {
    throw new Error("出站 URL 格式无效");
  }

  if (url.protocol !== "https:" && !(policy.allowHttp && url.protocol === "http:")) {
    throw new Error("出站 URL 必须使用 HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("出站 URL 不允许包含用户名或密码");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("出站 URL 不允许访问本机或本地域名");
  }

  const allowedHosts = policy.allowedHosts ?? [];
  if (allowedHosts.length > 0 && !allowedHosts.some((entry) => matchesAllowedHost(hostname, entry))) {
    throw new Error(`出站目标不在允许列表中: ${hostname}`);
  }

  if (!policy.allowPrivate) {
    const addresses = isIP(hostname)
      ? [hostname]
      : await (policy.lookupAddresses ?? defaultLookupAddresses)(hostname);
    if (addresses.length === 0) throw new Error(`出站目标无法解析: ${hostname}`);
    if (addresses.some(isPrivateOrReservedIp)) {
      throw new Error(`出站 URL 解析到私有或保留地址: ${hostname}`);
    }
  }

  return url;
}

function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch wrapper for server-side outbound integrations.
 * - Every call has a deadline.
 * - GET/HEAD retry transient failures by default; unsafe methods require explicit attempts.
 * - User-controlled URLs can opt into DNS/private-range validation and redirect checks.
 */
export async function outboundFetch(
  input: string | URL,
  init: RequestInit = {},
  policy: OutboundFetchPolicy = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const attempts = Math.max(1, policy.attempts ?? (method === "GET" || method === "HEAD" ? 3 : 1));
  const timeoutMs = Math.max(1, policy.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const maxRedirects = Math.max(0, policy.maxRedirects ?? 0);
  let currentUrl = input instanceof URL ? new URL(input.toString()) : new URL(input);
  let currentInit: RequestInit = { ...init };

  for (let redirectCount = 0; ; redirectCount++) {
    if (policy.validateUrl) {
      currentUrl = await assertSafeOutboundUrl(currentUrl, policy);
    }

    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        response = await fetch(currentUrl, {
          ...currentInit,
          redirect: policy.validateUrl ? "manual" : currentInit.redirect,
          signal: withTimeout(currentInit.signal, timeoutMs),
        });
        if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) break;
        await response.body?.cancel();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) throw error;
      }
      await wait((policy.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS) * attempt);
    }

    if (!response) throw lastError ?? new Error("出站请求失败");
    if (!policy.validateUrl || !REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) return response;
    if (redirectCount >= maxRedirects) {
      await response.body?.cancel();
      throw new Error("出站请求重定向次数超限");
    }

    const nextUrl = new URL(location, currentUrl);
    const crossesOrigin = nextUrl.origin !== currentUrl.origin;
    if (crossesOrigin && currentInit.headers) {
      const headers = new Headers(currentInit.headers);
      headers.delete("authorization");
      headers.delete("cookie");
      headers.delete("proxy-authorization");
      currentInit = { ...currentInit, headers };
    }
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
      const headers = new Headers(currentInit.headers);
      headers.delete("content-type");
      currentInit = { ...currentInit, method: "GET", body: undefined, headers };
    }
    await response.body?.cancel();
    currentUrl = nextUrl;
  }
}
