// 分发适配器注册表
import type { DistributionAdapter } from "./base";
import type { DistributionPlatform } from "../platforms";

import { ZhihuAdapter } from "./zhihu";
import { WeChatAdapter } from "./wechat";
import { BaiduSearchAdapter, SogouSearchAdapter, So360SearchAdapter, ShenmaSearchAdapter } from "./search";
import { CozeAdapter, BaiduWenxinAdapter, TencentYuanbaoAdapter, DingtalkAdapter } from "./ai";
import { BaijiahaoAdapter, DouyinAdapter, XiaohongshuAdapter } from "./content";

// 适配器映射
const adapters: Partial<Record<DistributionPlatform, DistributionAdapter>> = {
  // 社交平台
  ZHIHU: new ZhihuAdapter(),
  WECHAT_MP: new WeChatAdapter(),
  NOTION: {
    platform: "NOTION",
    name: "Notion",
    validateConfig: (config) => ({
      valid: Boolean(config.apiKey && config.databaseId),
      missing: !config.apiKey ? ["apiKey"] : !config.databaseId ? ["databaseId"] : [],
    }),
    distribute: async (config, input) => {
      const apiKey = config.apiKey as string;
      const databaseId = config.databaseId as string;
      if (!apiKey || !databaseId) return { success: false, error: "Notion apiKey/databaseId 未配置" };

      try {
        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties: {
              Name: { title: [{ text: { content: input.title } }] },
            },
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: input.excerpt || input.content.slice(0, 2000) } }],
                },
              },
            ],
          }),
        });

        if (!res.ok) return { success: false, error: `Notion API ${res.status}` };
        const json = await res.json() as { id?: string; url?: string };
        return { success: true, externalId: json.id, externalUrl: json.url };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  },
  FEISHU_DOC: {
    platform: "FEISHU_DOC",
    name: "飞书文档",
    validateConfig: (config) => ({
      valid: Boolean(config.appId && config.appSecret),
      missing: !config.appId ? ["appId"] : !config.appSecret ? ["appSecret"] : [],
    }),
    distribute: async (config, input) => {
      const appId = config.appId as string;
      const appSecret = config.appSecret as string;
      if (!appId || !appSecret) return { success: false, error: "飞书 appId/appSecret 未配置" };

      try {
        // 1. 获取 tenant_access_token
        const tokenRes = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenantAccessToken/internal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        });
        
        if (!tokenRes.ok) return { success: false, error: `获取飞书 token 失败: ${tokenRes.status}` };
        const tokenJson = await tokenRes.json() as { tenantAccessToken?: string };
        if (!tokenJson.tenantAccessToken) return { success: false, error: "获取 tenant_access_token 失败" };

        const token = tokenJson.tenantAccessToken;

        // 2. 创建文档
        const docRes = await fetch("https://open.feishu.cn/open-apis/docx/v1/documents", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: input.title,
          }),
        });

        if (!docRes.ok) return { success: false, error: `创建飞书文档失败: ${docRes.status}` };
        const docJson = await docRes.json() as { data?: { document?: { document_id?: string; url?: string } } };
        
        return {
          success: true,
          externalId: docJson.data?.document?.document_id,
          externalUrl: docJson.data?.document?.url,
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  },
  CUSTOM_WEBHOOK: {
    platform: "CUSTOM_WEBHOOK",
    name: "自定义 Webhook",
    validateConfig: (config) => ({
      valid: Boolean(config.url),
      missing: !config.url ? ["url"] : [],
    }),
    distribute: async (config, input) => {
      const url = config.url as string;
      if (!url) return { success: false, error: "Webhook URL 未配置" };

      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.secret) {
          // 可添加签名验证
          headers["X-Signature"] = `sha256=${config.secret}`;
        }

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: input.title,
            content: input.content,
            excerpt: input.excerpt,
            url: input.url,
            timestamp: Date.now(),
          }),
        });

        if (!res.ok) return { success: false, error: `Webhook ${res.status}` };
        
        let externalUrl: string | undefined;
        let externalId: string | undefined;
        try {
          const json = await res.json() as { url?: string; id?: string };
          externalUrl = json.url;
          externalId = json.id;
        } catch {
          // 非 JSON 响应
        }
        
        return { success: true, externalUrl, externalId };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  },

  // 内容平台
  BAIJIAHAO: new BaijiahaoAdapter(),
  DOUYIN: new DouyinAdapter(),
  XIAOHONGSHU: new XiaohongshuAdapter(),

  // AI 智能体
  COZE: new CozeAdapter(),
  BAIDU_WENXIN: new BaiduWenxinAdapter(),
  TENCENT_YUANBAO: new TencentYuanbaoAdapter(),
  DINGTALK: new DingtalkAdapter(),

  // 搜索引擎
  BAIDU_SEARCH: new BaiduSearchAdapter(),
  SOGOU_SEARCH: new SogouSearchAdapter(),
  SO360_SEARCH: new So360SearchAdapter(),
  SHENMA_SEARCH: new ShenmaSearchAdapter(),

  // 引用/收录（暂不支持）
  CITATION_SITE: {
    platform: "CITATION_SITE",
    name: "引用站点",
    validateConfig: () => ({ valid: true, missing: [] }),
    distribute: async () => ({ success: false, error: "请在配置中设置具体的提交方式" }),
  },
  INDEX_SITE: {
    platform: "INDEX_SITE",
    name: "收录站点",
    validateConfig: () => ({ valid: true, missing: [] }),
    distribute: async () => ({ success: false, error: "请在配置中设置具体的提交方式" }),
  },
};

export function getAdapter(platform: DistributionPlatform): DistributionAdapter | undefined {
  return adapters[platform];
}

export function getAllAdapters(): DistributionAdapter[] {
  return Object.values(adapters).filter(Boolean) as DistributionAdapter[];
}

export { type DistributionAdapter, type DistributionInput, type DistributionResult } from "./base";
