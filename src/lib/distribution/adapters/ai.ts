// AI 智能体分发适配器
import type { DistributionAdapter, DistributionInput, DistributionResult } from "./base";

// 字节扣子 (Coze) 适配器
export class CozeAdapter implements DistributionAdapter {
  readonly platform = "COZE";
  readonly name = "字节扣子";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.apiKey) missing.push("apiKey");
    if (!config.botId) missing.push("botId");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const apiKey = config.apiKey as string;
    const botId = config.botId as string;
    const spaceId = config.spaceId as string | undefined;
    if (!apiKey || !botId) return { success: false, error: "Coze apiKey/botId 未配置" };

    try {
      // Coze API - 创建知识库文档或发布到 bot
      const res = await fetch("https://api.coze.cn/v1/documents/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          space_id: spaceId || "",
          name: input.title,
          content: `${input.title}\n\n${input.content}`,
          chunk_method: "naive",
        }),
      });

      if (!res.ok) return { success: false, error: `Coze API ${res.status}` };

      const json = await res.json() as { code?: number; data?: { document_id?: string }; msg?: string };
      if (json.code !== 0) return { success: false, error: `Coze: ${json.msg}` };

      return {
        success: true,
        externalId: json.data?.document_id,
        externalUrl: `https://www.coze.cn/space/${spaceId}/bot/${botId}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 百度文心适配器
export class BaiduWenxinAdapter implements DistributionAdapter {
  readonly platform = "BAIDU_WENXIN";
  readonly name = "百度文心";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.apiKey) missing.push("apiKey");
    if (!config.secretKey) missing.push("secretKey");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const apiKey = config.apiKey as string;
    const secretKey = config.secretKey as string;
    if (!apiKey || !secretKey) return { success: false, error: "百度文心 apiKey/secretKey 未配置" };

    try {
      // 1. 获取 access token
      const tokenRes = await fetch(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
        { method: "POST" }
      );
      
      if (!tokenRes.ok) return { success: false, error: `获取百度 access_token 失败: ${tokenRes.status}` };
      
      const tokenJson = await tokenRes.json() as { access_token?: string };
      if (!tokenJson.access_token) return { success: false, error: "获取 access_token 失败" };

      // 2. 上传文档到知识库
      const uploadRes = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/knowledge/${config.agentId}/doc/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          content: `${input.title}\n\n${input.content}`,
        }),
      });

      if (!uploadRes.ok) return { success: false, error: `百度文心上传统败: ${uploadRes.status}` };

      return {
        success: true,
        externalUrl: `https://wenxin.baidu.com/knowledge/${config.agentId}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 腾讯元宝适配器
export class TencentYuanbaoAdapter implements DistributionAdapter {
  readonly platform = "TENCENT_YUANBAO";
  readonly name = "腾讯元宝";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.appId) missing.push("appId");
    if (!config.appSecret) missing.push("appSecret");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const appId = config.appId as string;
    const appSecret = config.appSecret as string;
    if (!appId || !appSecret) return { success: false, error: "腾讯元宝 appId/appSecret 未配置" };

    try {
      // 腾讯元宝 API（通过腾讯云代理）
      const res = await fetch("https://yuanbao.tencent.com/api/v1/content/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Id": appId,
          "X-App-Secret": appSecret,
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          excerpt: input.excerpt,
        }),
      });

      if (!res.ok) return { success: false, error: `腾讯元宝 API ${res.status}` };

      const json = await res.json() as { code?: number; data?: { id?: string } };
      if (json.code !== 0) return { success: false, error: `腾讯元宝: ${json.code}` };

      return {
        success: true,
        externalId: json.data?.id,
        externalUrl: `https://yuanbao.tencent.com/content/${json.data?.id}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// 钉钉适配器
export class DingtalkAdapter implements DistributionAdapter {
  readonly platform = "DINGTALK";
  readonly name = "钉钉";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.clientId) missing.push("clientId");
    if (!config.clientSecret) missing.push("clientSecret");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const clientId = config.clientId as string;
    const clientSecret = config.clientSecret as string;
    const chatId = config.chatId as string | undefined;
    if (!clientId || !clientSecret) return { success: false, error: "钉钉 clientId/clientSecret 未配置" };

    try {
      // 1. 获取 access_token
      const tokenRes = await fetch("https://api.dingtalk.com/v1/oauth2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appKey: clientId, appSecret: clientSecret }),
      });

      if (!tokenRes.ok) return { success: false, error: `获取钉钉 access_token 失败: ${tokenRes.status}` };
      
      const tokenJson = await tokenRes.json() as { accessToken?: string; errCode?: number };
      if (!tokenJson.accessToken) return { success: false, error: "获取 access_token 失败" };

      const accessToken = tokenJson.accessToken;

      // 2. 发送消息
      if (chatId) {
        const msgRes = await fetch("https://api.dingtalk.com/v1.0/im/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-acs-dingtalk-access-token": accessToken,
          },
          body: JSON.stringify({
            chatId,
            msgType: "markdown",
            markdown: {
              title: input.title,
              text: `## ${input.title}\n\n${input.excerpt || input.content.slice(0, 500)}`,
            },
          }),
        });

        if (!msgRes.ok) return { success: false, error: `发送消息失败: ${msgRes.status}` };
      }

      return {
        success: true,
        externalId: chatId,
        externalUrl: `https://oapi.dingtalk.com/chat/${chatId}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
