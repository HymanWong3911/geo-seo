// 搜索引擎 URL 提交适配器
import type { DistributionAdapter, DistributionInput, DistributionResult } from "./base";

interface SearchEngineAdapter extends DistributionAdapter {
  readonly searchEngine: string;
}

// 百度搜索提交
export class BaiduSearchAdapter implements SearchEngineAdapter {
  readonly platform = "BAIDU_SEARCH";
  readonly searchEngine = "baidu";
  readonly name = "百度搜索";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.siteUrl) missing.push("siteUrl");
    if (!config.token) missing.push("token");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const siteUrl = config.siteUrl as string;
    const token = config.token as string;
    if (!siteUrl || !token) return { success: false, error: "百度搜索 siteUrl/token 未配置" };

    if (!input.url) return { success: false, error: "缺少文章 URL" };

    try {
      // 百度搜索资源平台主动推送 API
      const res = await fetch(`https://data.zz.baidu.com/urls?site=${encodeURIComponent(siteUrl)}&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: input.url,
      });

      if (!res.ok) return { success: false, error: `百度提交失败: ${res.status}` };

      const json = await res.json() as { success?: number; remain?: number; error?: number; message?: string };
      
      if (json.error) {
        return { success: false, error: `百度提交失败: ${json.message}` };
      }

      return {
        success: true,
        externalId: String(json.success || 1),
        externalUrl: input.url,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 搜狗搜索提交
export class SogouSearchAdapter implements SearchEngineAdapter {
  readonly platform = "SOGOU_SEARCH";
  readonly searchEngine = "sogou";
  readonly name = "搜狗搜索";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.siteUrl) missing.push("siteUrl");
    if (!config.token) missing.push("token");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const siteUrl = config.siteUrl as string;
    const token = config.token as string;
    if (!siteUrl || !token) return { success: false, error: "搜狗搜索 siteUrl/token 未配置" };

    if (!input.url) return { success: false, error: "缺少文章 URL" };

    try {
      // 搜狗搜索推送 API
      const res = await fetch(`https://zhanzhang.sogou.com/站长工具/URL提交/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "APIKEY": token,
        },
        body: JSON.stringify({
          url: input.url,
          site: siteUrl,
        }),
      });

      if (!res.ok) return { success: false, error: `搜狗提交失败: ${res.status}` };

      return {
        success: true,
        externalUrl: input.url,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 360搜索提交
export class So360SearchAdapter implements SearchEngineAdapter {
  readonly platform = "SO360_SEARCH";
  readonly searchEngine = "360";
  readonly name = "360搜索";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.siteUrl) missing.push("siteUrl");
    if (!config.token) missing.push("token");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const siteUrl = config.siteUrl as string;
    const token = config.token as string;
    if (!siteUrl || !token) return { success: false, error: "360搜索 siteUrl/token 未配置" };

    if (!input.url) return { success: false, error: "缺少文章 URL" };

    try {
      // 360 搜索推送 API
      const res = await fetch(`https://zhanzhang.so.com/api/url/submit?site=${encodeURIComponent(siteUrl)}&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [input.url] }),
      });

      if (!res.ok) return { success: false, error: `360提交失败: ${res.status}` };

      const json = await res.json() as { returnCode?: string; message?: string };
      
      if (json.returnCode !== "0") {
        return { success: false, error: `360提交失败: ${json.message}` };
      }

      return {
        success: true,
        externalUrl: input.url,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 神马搜索提交
export class ShenmaSearchAdapter implements SearchEngineAdapter {
  readonly platform = "SHENMA_SEARCH";
  readonly searchEngine = "shenma";
  readonly name = "神马搜索";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.siteUrl) missing.push("siteUrl");
    if (!config.token) missing.push("token");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const siteUrl = config.siteUrl as string;
    const token = config.token as string;
    if (!siteUrl || !token) return { success: false, error: "神马搜索 siteUrl/token 未配置" };

    if (!input.url) return { success: false, error: "缺少文章 URL" };

    try {
      // 神马搜索推送 API（通过神马站长平台）
      const res = await fetch(`https://zhanzhang.sm.cn/api/push?site=${encodeURIComponent(siteUrl)}&token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [input.url] }),
      });

      if (!res.ok) return { success: false, error: `神马提交失败: ${res.status}` };

      return {
        success: true,
        externalUrl: input.url,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
