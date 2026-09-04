// 品牌监控。
// 使用 Bing 公开搜索 + DuckDuckGo 公开搜索 API。
// 配置文件：.env 中 BRAND_SEARCH_ENGINE_URL / BRAND_SEARCH_ENGINES

import { prisma } from "@/lib/db";

export interface BrandMonitorInput {
  projectId: string;
  brands: string[];       // 主品牌 + 别名
  competitors: string[];
  keywords?: string[];    // 项目关键词(提升查询相关性 + 内容过滤)
  sinceDays?: number;
  maxResults?: number;
}

export interface BrandMentionResult {
  source: string;
  url: string;
  title: string;
  content: string;
  brandName: string;
  mentionType: "primary_brand" | "competitor";
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  publishedAt: Date;
  relevanceScore: number;
}

interface SearchHit {
  url: string;
  title: string;
  content: string;
  engine?: string;
}

// Bing 公开搜索
async function searchBing(query: string, maxResults = 5): Promise<SearchHit[]> {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    
    const results: SearchHit[] = [];
    
    // 解析 Bing 搜索结果
    const liRegex = /<li class="b_algo"[^>]*>[\s\S]*?<\/li>/g;
    const liMatches = html.match(liRegex) || [];
    
    for (const li of liMatches.slice(0, maxResults * 2)) {
      const urlMatch = li.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/);
      const titleMatch = li.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      const snippetMatch = li.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
        const content = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        
        if (!url.includes("bing.com") && !url.includes("microsoft.com")) {
          results.push({ url, title, content: content.slice(0, 500), engine: "bing" });
          if (results.length >= maxResults) break;
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// SearXNG 搜索（备选，如果配置了）
async function searchSearXNG(query: string, maxResults = 10): Promise<SearchHit[]> {
  const SEARCH_URL = process.env.BRAND_SEARCH_ENGINE_URL ?? "http://localhost:8888";
  const ENGINES = process.env.BRAND_SEARCH_ENGINES ?? "google,bing,duckduckgo";
  
  try {
    const url = `${SEARCH_URL}/search?q=${encodeURIComponent(query)}&format=json&engines=${ENGINES}&limit=${maxResults}`;
    const res = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ url: string; title: string; content: string; engine?: string }>;
    };
    return (data.results ?? []).slice(0, maxResults).map((r) => ({
      url: r.url ?? "",
      title: r.title ?? "",
      content: r.content ?? r.title ?? "",
      engine: r.engine,
    }));
  } catch {
    return [];
  }
}

// 360 搜索独立抓取（解析 HTML，备用源）
async function search360Independent(query: string, maxResults = 5): Promise<SearchHit[]> {
  try {
    const url = `https://www.so.com/s?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchHit[] = [];
    const titleRe = /<h3[^>]*class="res-title"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = titleRe.exec(html)) !== null && results.length < maxResults) {
      const link = m[1];
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      if (seen.has(link) || !title) continue;
      seen.add(link);
      const start = m.index + m[0].length;
      const chunk = html.substring(start, start + 600);
      const snippet = chunk.match(/<p[^>]*class="res-desc"[^>]*>([\s\S]*?)<\/p>/);
      const content = snippet ? snippet[1].replace(/<[^>]+>/g, "").trim() : "";
      results.push({ url: link, title, content: content.slice(0, 500), engine: "360" });
    }
    return results;
  } catch {
    return [];
  }
}

// 简单情感分析（基于关键词）
function analyzeSentiment(text: string): "positive" | "neutral" | "negative" | "mixed" {
  const positive = ["推荐", "优秀", "领先", "最好", "强", "最佳", "专业", "好", "优秀"];
  const negative = ["差", "问题", "不好", "慢", "贵", "不推荐", "失望", "坑", "负面"];
  let pos = 0, neg = 0;
  for (const w of positive) if (text.includes(w)) pos++;
  for (const w of negative) if (text.includes(w)) neg++;
  if (pos > 0 && neg > 0) return "mixed";
  if (pos > neg) return "positive";
  if (neg > 0) return "negative";
  return "neutral";
}

export async function monitorBrand(
  input: BrandMonitorInput,
): Promise<BrandMentionResult[]> {
  const results: BrandMentionResult[] = [];
  const maxResults = input.maxResults ?? 5;

  const queries: Array<{ name: string; type: "primary_brand" | "competitor" }> = [
    ...input.brands.map((b) => ({ name: b, type: "primary_brand" as const })),
    ...input.competitors.map((c) => ({
      name: c,
      type: "competitor" as const,
    })),
  ];

  // 项目关键词(取前 3 个,避免 query 太长)
  const kwList = (input.keywords ?? []).slice(0, 3);

  const configuredConcurrency = Number(process.env.BRAND_MONITOR_CONCURRENCY ?? 3);
  const concurrency = Number.isFinite(configuredConcurrency)
    ? Math.max(1, Math.min(6, Math.floor(configuredConcurrency)))
    : 3;

  // Search providers used to run as a four-step fallback chain for every name.
  // A blocked provider could therefore cost ~40s per name. Query a small batch
  // of names concurrently and race the provider timeouts in parallel, while
  // preserving provider priority when choosing the usable result set.
  for (let start = 0; start < queries.length; start += concurrency) {
    const batch = queries.slice(start, start + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (q): Promise<BrandMentionResult[]> => {
        // 2026-07-23:query 拼接关键词,提升搜索引擎相关性
        // 例: query = `森田连锁咨询 连锁咨询 加盟` 而不是只 `森田连锁咨询`
        // 同时:keyword set 后面用于过滤"内容不沾关键词/品牌"的结果
        const kwSuffix = kwList.length > 0 ? " " + kwList.join(" ") : "";
        const searchQuery = `${q.name}${kwSuffix}`;
        const providerResults = await Promise.all([
          searchSearXNG(searchQuery, maxResults),
          searchBing(searchQuery, maxResults),
          searchDuckDuckGo(searchQuery, maxResults),
          search360Independent(searchQuery, maxResults),
        ]);
        const hits = (providerResults.find((items) => items.length > 0) ?? []).slice(0, maxResults);
        const mentions: BrandMentionResult[] = [];

        for (const h of hits) {
          const text = `${h.title} ${h.content}`;
          // 2026-07-23:过滤与品牌/关键词都无关的内容
          const lower = text.toLowerCase();
          const brandHit = lower.includes(q.name.toLowerCase());
          const kwHit = kwList.some((k) => lower.includes(k.toLowerCase()));
          if (!brandHit && !kwHit) continue; // 丢弃不相关

          const sentiment = analyzeSentiment(text);
          // relevance: brand name(85) + 关键词 hit 加成(每中 1 个 +5,封顶 100)
          let relevanceScore = brandHit ? 85 : 50;
          if (kwHit) {
            const kwMatches = kwList.filter((k) => lower.includes(k.toLowerCase())).length;
            relevanceScore = Math.min(100, relevanceScore + kwMatches * 5);
          }

          mentions.push({
            source: h.engine ?? "bing",
            url: h.url,
            title: h.title,
            content: h.content,
            brandName: q.name,
            mentionType: q.type,
            sentiment,
            publishedAt: new Date(),
            relevanceScore,
          });
        }
        return mentions;
      }),
    );
    results.push(...batchResults.flat());
  }

  // 持久化（upsert 避免重复扫描堆积）
  if (results.length > 0) {
    for (const r of results) {
      try {
        await prisma.brandMention.upsert({
          where: {
            uniq_project_sourceUrl: { projectId: input.projectId, sourceUrl: r.url },
          },
          create: {
            projectId: input.projectId,
            source: r.source,
            sourceUrl: r.url,
            title: r.title,
            content: r.content,
            mentionType: r.mentionType,
            brandName: r.brandName,
            sentiment: r.sentiment,
            publishedAt: r.publishedAt,
            relevanceScore: r.relevanceScore,
          },
          update: {
            title: r.title,
            content: r.content,
            sentiment: r.sentiment,
            publishedAt: r.publishedAt,
            relevanceScore: r.relevanceScore,
            discoveredAt: new Date(),
          },
        });
      } catch (err) {
        console.error("[brand-monitor] upsert failed", r.url, err);
      }
    }
  }

  return results;
}

// DuckDuckGo HTML 抓取（备用源 — 不需要 API key）
async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchHit[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchHit[] = [];
    // DDG HTML 结构: <a class="result__a" href="...">title</a> <a class="result__snippet">snippet</a>
    const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = resultRe.exec(html)) !== null && results.length < maxResults) {
      // 提取真实 URL(DDG 重定向 URL 在 uddg= 参数里)
      let link = m[1];
      const uddgMatch = link.match(/[?&]uddg=([^&]+)/);
      if (uddgMatch) {
        try { link = decodeURIComponent(uddgMatch[1]); } catch { /* keep original */ }
      }
      if (seen.has(link) || !link.startsWith("http")) continue;
      seen.add(link);
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      const content = m[3].replace(/<[^>]+>/g, "").trim();
      if (!title) continue;
      results.push({ url: link, title, content: content.slice(0, 500), engine: "duckduckgo" });
    }
    return results;
  } catch {
    return [];
  }
}

// 修复:把 DuckDuckGo 加到 monitorBrand 的 fallback 链
