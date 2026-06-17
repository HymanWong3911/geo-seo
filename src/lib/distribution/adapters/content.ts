// 内容平台分发适配器
import type { DistributionAdapter, DistributionInput, DistributionResult } from "./base";

// 百家号适配器
export class BaijiahaoAdapter implements DistributionAdapter {
  readonly platform = "BAIJIAHAO";
  readonly name = "百家号";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.apiKey) missing.push("apiKey");
    if (!config.accountId) missing.push("accountId");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const apiKey = config.apiKey as string;
    const accountId = config.accountId as string;
    if (!apiKey || !accountId) return { success: false, error: "百家号 apiKey/accountId 未配置" };

    try {
      // 百家号开放平台 API
      const res = await fetch("https://baijiahao.baidu.com/v1/content/article/publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: accountId,
          title: input.title,
          content: input.content,
          abstract: input.excerpt,
          category: config.category as string || "科技",
          origin_url: input.url,
        }),
      });

      if (!res.ok) return { success: false, error: `百家号 API ${res.status}` };

      const json = await res.json() as { code?: number; data?: { article_id?: string }; msg?: string };
      if (json.code !== 0) return { success: false, error: `百家号: ${json.msg}` };

      return {
        success: true,
        externalId: json.data?.article_id,
        externalUrl: `https://baijiahao.baidu.com/${json.data?.article_id}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 抖音/头条号适配器
export class DouyinAdapter implements DistributionAdapter {
  readonly platform = "DOUYIN";
  readonly name = "抖音/头条号";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.clientKey) missing.push("clientKey");
    if (!config.clientSecret) missing.push("clientSecret");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const clientKey = config.clientKey as string;
    const clientSecret = config.clientSecret as string;
    const accountId = config.accountId as string;
    if (!clientKey || !clientSecret) return { success: false, error: "抖音 clientKey/clientSecret 未配置" };

    try {
      // 1. 获取 access_token
      const tokenRes = await fetch("https://open.toutiao.com/oauth/access_token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: "client_credential",
        }),
      });

      if (!tokenRes.ok) return { success: false, error: `获取抖音 access_token 失败: ${tokenRes.status}` };
      
      const tokenJson = await tokenRes.json() as { data?: { access_token?: string } };
      if (!tokenJson.data?.access_token) return { success: false, error: "获取 access_token 失败" };

      const accessToken = tokenJson.data.access_token;

      // 2. 上传文章
      const res = await fetch("https://open.toutiao.com/article/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          abstract: input.excerpt,
          account_id: accountId,
        }),
      });

      if (!res.ok) return { success: false, error: `抖音发布失败: ${res.status}` };

      const json = await res.json() as { data?: { item_id?: string } };
      return {
        success: true,
        externalId: json.data?.item_id,
        externalUrl: `https://www.toutiao.com/article/${json.data?.item_id}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 小红书适配器（仅支持 webhook 模式）
export class XiaohongshuAdapter implements DistributionAdapter {
  readonly platform = "XIAOHONGSHU";
  readonly name = "小红书";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    // 小红书需要人工操作，返回警告
    return { valid: false, missing: ["此平台仅支持手动发布"] };
  }

  async distribute(_config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    // 小红书不支持 API 发布
    return {
      success: false,
      error: "小红书不支持 API 自动发布，请手动复制内容到小红书发布",
    };
  }
}
