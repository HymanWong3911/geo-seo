// 页面爬虫。
// 详细说明见 dev doc v1.2 10.1 节。
// 优先用 Playwright（拿性能指标 + 真实渲染），fallback 到 fetch + cheerio。

import type { PerformanceData } from "@/lib/seo/analyzer";

export interface CrawlResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  performance: PerformanceData;
  method: "playwright" | "fetch";
}

const TIMEOUT_MS = 30_000;
const PERFORMANCE_WAIT_MS = 3_000;

let playwrightAvailable: boolean | null = null;
async function isPlaywrightAvailable(): Promise<boolean> {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    // 动态 import：playwright 可能没装
    await import("playwright");
    playwrightAvailable = true;
  } catch {
    playwrightAvailable = false;
  }
  return playwrightAvailable;
}

async function crawlWithPlaywright(url: string): Promise<CrawlResult> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; SearchVisibilityConsole/1.0; +https://example.com/bot)",
    });
    const page = await context.newPage();

    const response = await page.goto(url, {
      timeout: TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });

    // 收集性能数据
    const performance = await page.evaluate((): Promise<PerformanceData> => {
      return new Promise((resolve) => {
        const data: PerformanceData = {
          ttfb: 0,
          fcp: null,
          lcp: null,
          tbt: 0,
        };

        const perf = (typeof performance !== "undefined" ? performance : (window as any).performance) as Performance;
        const nav = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav) {
          data.ttfb = nav.responseStart - nav.requestStart;
        }

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
          // 某些浏览器不支持所有 observer
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
    };
  } finally {
    await browser.close();
  }
}

async function crawlWithFetch(url: string): Promise<CrawlResult> {
  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SearchVisibilityConsole/1.0; +https://example.com/bot)",
    },
  });
  const ttfb = Date.now() - t0;
  const html = await res.text();

  return {
    url,
    finalUrl: res.url,
    statusCode: res.status,
    html,
    performance: {
      ttfb,
      fcp: null,   // fetch 拿不到
      lcp: null,
      tbt: 0,
    },
    method: "fetch",
  };
}

export async function crawlPage(url: string): Promise<CrawlResult> {
  if (await isPlaywrightAvailable()) {
    try {
      return await crawlWithPlaywright(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[crawler] playwright failed, fallback to fetch:", err);
    }
  }
  return crawlWithFetch(url);
}
