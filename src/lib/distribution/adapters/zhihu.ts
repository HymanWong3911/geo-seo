// 知乎分发适配器
import type { DistributionAdapter, DistributionInput, DistributionResult } from "./base";

export class ZhihuAdapter implements DistributionAdapter {
  readonly platform = "ZHIHU";
  readonly name = "知乎";

  validateConfig(config: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!config.token) missing.push("token");
    return { valid: missing.length === 0, missing };
  }

  async distribute(config: Record<string, unknown>, input: DistributionInput): Promise<DistributionResult> {
    const token = config.token as string;
    if (!token) return { success: false, error: "知乎 token 未配置" };

    try {
      // 知乎开放平台 API
      // 实际需要先获取用户信息，然后创建文章
      const res = await fetch("https://api.zhihu.com/articles", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          column_id: config.columnId || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { success: false, error: `知乎 API ${res.status}: ${error}` };
      }

      const json = await res.json() as { id?: string; url?: string };
      return {
        success: true,
        externalId: String(json.id),
        externalUrl: json.url || `https://zhuanlan.zhihu.com/p/${json.id}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
