// 搜索引擎提交。
// 详细说明见 dev doc v1.2 18.16 + M10 B 节。
// - sitemap 提交到 Google / 百度
// - URL ping（实时告知搜索引擎有新内容）

import { prisma } from "@/lib/db";

interface SubmitResult {
  success: boolean;
  message: string;
  response?: unknown;
}

export async function submitSitemap(
  sitemapUrl: string,
  engine: "google" | "baidu" | "both" = "both",
): Promise<SubmitResult[]> {
  const results: SubmitResult[] = [];

  if (engine === "google" || engine === "both") {
    try {
      // Google Search Console API（需要 OAuth 凭据）
      // 简化：使用 IndexNow-like 的 ping URL
      const res = await fetch(
        `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      );
      results.push({
        success: res.ok,
        message: `Google sitemap 提交: ${res.status}`,
        response: await res.text().catch(() => null),
      });
    } catch (err) {
      results.push({ success: false, message: `Google 提交失败: ${err}` });
    }
  }

  if (engine === "baidu" || engine === "both") {
    try {
      // 百度站长平台 sitemap 推送
      // http://data.zz.baidu.com/urls?site=www.example.com&token=xxx
      // 简化：通用 ping
      const res = await fetch(
        `https://www.baidu.com/sitemap?url=${encodeURIComponent(sitemapUrl)}`,
      );
      results.push({
        success: res.ok,
        message: `百度 sitemap 提交: ${res.status}`,
      });
    } catch (err) {
      results.push({ success: false, message: `百度提交失败: ${err}` });
    }
  }

  // 写历史
  if (results.length > 0) {
    await prisma.auditLog.create({
      data: {
        action: "REPORT_EXPORT",
        metadata: {
          action: "sitemap-submit",
          sitemapUrl,
          results: results.map((r) => ({ engine, success: r.success, message: r.message })),
        },
      },
    });
  }

  return results;
}

export async function pingUrl(
  url: string,
  engine: "google" | "baidu" | "indexnow" | "all" = "all",
): Promise<SubmitResult[]> {
  const results: SubmitResult[] = [];

  if (engine === "google" || engine === "all") {
    try {
      // Google sitemap ping（也接受 URL）
      const res = await fetch(
        `https://www.google.com/ping?sitemap=${encodeURIComponent(url)}`,
      );
      results.push({ success: res.ok, message: `Google ping: ${res.status}` });
    } catch (err) {
      results.push({ success: false, message: `Google ping 失败: ${err}` });
    }
  }

  if (engine === "baidu" || engine === "all") {
    try {
      const res = await fetch(`https://www.baidu.com/sitemap?url=${encodeURIComponent(url)}`);
      results.push({ success: res.ok, message: `百度 ping: ${res.status}` });
    } catch (err) {
      results.push({ success: false, message: `百度 ping 失败: ${err}` });
    }
  }

  if (engine === "indexnow" || engine === "all") {
    // IndexNow（Bing / Yandex）
    // 简版：不需要 key 时跳过
    results.push({ success: true, message: "IndexNow 跳过（未配置 key）" });
  }

  return results;
}
