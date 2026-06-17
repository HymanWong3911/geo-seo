// 页面爬虫。
// 详细说明见 dev doc v1.2 10.1 节。
// 优先用 Playwright（拿性能指标 + 真实渲染），fallback 到 fetch + cheerio。
// v1.3: 启用 ignoreHTTPSErrors（兼容 TLS 协商异常站点），
//       返回 errors[] 让上层能区分 network/TLS/timeout 等失败原因。

import type { PerformanceData } from "@/lib/seo/analyzer";

export interface CrawlError {
  phase: "playwright" | "fetch";
  kind: "tls" | "timeout" | "dns" | "refused" | "http" | "other";
  message: string;
}

export interface CrawlResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  performance: PerformanceData;
  method: "playwright" | "fetch" | "fetch-https-ignore" | "failed";
  errors: CrawlError[];
  elapsedMs: number;
}

const TIMEOUT_MS = 30_000;
const PERFORMANCE_WAIT_MS = 3_000;

let playwrightAvailable: boolean | null = null;
async function isPlaywrightAvailable(): Promise<boolean> {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    await import("playwright");
    playwrightAvailable = true;
  } catch {
    playwrightAvailable = false;
  }
  return playwrightAvailable;
}

function classifyError(message: string): CrawlError["kind"] {
  const m = message.toLowerCase();
  if (m.includes("ssl") || m.includes("tls") || m.includes("cert")) return "tls";
  if (m.includes("timeout") || m.includes("timed out")) return "timeout";
  if (m.includes("enotfound") || m.includes("getaddrinfo") || m.includes("dns")) return "dns";
  if (m.includes("refused") || m.includes("econnrefused")) return "refused";
  if (m.includes("http")) return "http";
  return "other";
}

async function crawlWithPlaywright(url: string): Promise<CrawlResult> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const errors: CrawlError[] = [];
  const t0 = Date.now();
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; SearchVisibilityConsole/1.0; +https://example.com/bot)",
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    let response;
    try {
      response = await page.goto(url, {
        timeout: TIMEOUT_MS,
        waitUntil: "domcontentloaded",
      });
    } catch (err: any) {
      errors.push({
        phase: "playwright",
        kind: classifyError(err?.message ?? ""),
        message: String(err?.message ?? err).slice(0, 500),
      });
      // 即使 goto 失败（部分资源加载失败），仍尝试读取已渲染的内容
      try {
        const html = await page.content();
        if (html && html.length > 100) {
          return {
            url,
            finalUrl: page.url() || url,
            statusCode: 0,
            html,
            performance: { ttfb: 0, fcp: null, lcp: null, tbt: 0 },
            method: "playwright",
            errors,
            elapsedMs: Date.now() - t0,
          };
        }
      } catch {
        // ignore
      }
      throw err;
    }

    const performance = await page.evaluate((): Promise<PerformanceData> => {
      return new Promise((resolve) => {
        const data: PerformanceData = { ttfb: 0, fcp: null, lcp: null, tbt: 0 };
        const perf = (typeof performance !== "undefined" ? performance : (window as any).performance) as Performance;
        const nav = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav) data.ttfb = nav.responseStart - nav.requestStart;
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "paint" && entry.name === "first-contentful-paint") {
                data.fcp = entry.startTime;
              }
            }
          }).observe({ type: "paint", buffered: true });
          new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1);
            if (last) data.lcp = last.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            data.tbt = list
              .getEntries()
              .filter((e) => e.duration > 50)
              .reduce((sum, e) => sum + e.duration - 50, 0);
          }).observe({ type: "longtask", buffered: true });
        } catch {
          // 部分浏览器不支持所有 observer
        }
        setTimeout(() => resolve(data), 3000);
      });
    });

    const html = await page.content();

    return {
      url,
      finalUrl: page.url(),
      statusCode: response?.status() ?? 0,
      html,
      performance,
      method: "playwright",
      errors,
      elapsedMs: Date.now() - t0,
    };
  } finally {
    await browser.close();
  }
}

async function crawlWithFetch(url: string, opts: { ignoreTls?: boolean } = {}): Promise<CrawlResult> {
  const t0 = Date.now();
  const errors: CrawlError[] = [];
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SearchVisibilityConsole/1.0; +https://example.com/bot)",
      },
    } as RequestInit);
    const ttfb = Date.now() - t0;
    const html = await res.text();

    return {
      url,
      finalUrl: res.url,
      statusCode: res.status,
      html,
      performance: { ttfb, fcp: null, lcp: null, tbt: 0 },
      method: opts.ignoreTls ? "fetch-https-ignore" : "fetch",
      errors,
      elapsedMs: Date.now() - t0,
    };
  } catch (err: any) {
    errors.push({
      phase: "fetch",
      kind: classifyError(err?.message ?? ""),
      message: String(err?.message ?? err).slice(0, 500),
    });
    throw err;
  }
}

export async function crawlPage(url: string): Promise<CrawlResult> {
  if (await isPlaywrightAvailable()) {
    try {
      return await crawlWithPlaywright(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[crawler] playwright failed, fallback to fetch:", (err as Error).message?.slice(0, 200));
      // fetch 失败的话，错误链保留在返回里
      try {
        return await crawlWithFetch(url);
      } catch (fetchErr) {
        const fetchErrMsg = ((fetchErr as Error).message ?? String(fetchErr)).slice(0, 500);
        const fetchErrKind = classifyError(fetchErrMsg);
        // 兜底：https 失败 → 尝试 http（有些站点 TLS 配置坏，但 http 仍可用）
        let httpFallback: Awaited<ReturnType<typeof crawlWithFetch>> | null = null;
        if (url.startsWith("https://")) {
          try {
            httpFallback = await crawlWithFetch(url.replace(/^https:/, "http:"));
          } catch (httpErr) {
            // http 也挂了，继续到下面的失败分支
            httpFallback = null;
          }
        }
        if (httpFallback) {
          return httpFallback;
        }
        // 全部失败：返回带错误的占位结果，让上层展示
        return {
          url,
          finalUrl: url,
          statusCode: 0,
          html: "",
          performance: { ttfb: 0, fcp: null, lcp: null, tbt: 0 },
          method: "failed",
          errors: [
            {
              phase: "playwright",
              kind: classifyError((err as Error)?.message ?? ""),
              message: ((err as Error).message ?? String(err)).slice(0, 500),
            },
            {
              phase: "fetch",
              kind: fetchErrKind,
              message: fetchErrMsg,
            },
          ],
          elapsedMs: 0,
        };
      }
    }
  }
  return crawlWithFetch(url);
}
