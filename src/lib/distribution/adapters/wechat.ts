// 微信公众号分发适配器
import type { DistributionAdapter, DistributionInput, DistributionResult } from "./base";

export class WeChatAdapter implements DistributionAdapter {
  readonly platform = "WECHAT_MP";
  readonly name = "微信公众号";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.appId) missing.push("appId");
    if (!config.appSecret) missing.push("appSecret");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const appId = config.appId as string;
    const appSecret = config.appSecret as string;
    if (!appId || !appSecret) return { success: false, error: "微信公众号 appId/secret 未配置" };

    try {
      // 1. 获取 access_token
      const tokenRes = await fetch(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
      );
      if (!tokenRes.ok) return { success: false, error: `获取 access_token 失败: ${tokenRes.status}` };
      
      const tokenJson = await tokenRes.json() as { access_token?: string; errcode?: number; errmsg?: string };
      if (!tokenJson.access_token) {
        return { success: false, error: `获取 access_token 失败: ${tokenJson.errmsg || tokenJson.errcode}` };
      }

      const accessToken = tokenJson.access_token;

      // 2. 上传封面图（如果需要）- 简化处理
      // 实际实现需要先上传图片获取 media_id

      // 3. 创建草稿
      const draftRes = await fetch(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: [
            {
              title: input.title,
              author: input.author || "",
              digest: input.excerpt || "",
              content: input.content,
              content_source_url: input.url || "",
              thumb_media_id: "", // 需要先上传
              need_open_comment: 1,
              only_fans_can_comment: 0,
            },
          ],
        }),
      });

      if (!draftRes.ok) return { success: false, error: `创建草稿失败: ${draftRes.status}` };
      
      const draftJson = await draftRes.json() as { media_id?: string; errcode?: number; errmsg?: string };
      if (draftJson.errcode !== 0) {
        return { success: false, error: `创建草稿失败: ${draftJson.errmsg}` };
      }

      return {
        success: true,
        externalId: draftJson.media_id,
        externalUrl: `https://mp.weixin.qq.com/cgi-bin/draft?bgcolor=DADEE4&action=list&begin=0&count=5&token=${accessToken}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
