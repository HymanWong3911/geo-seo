// 测试一个分发目标是否可达。
// 用途:用户创建/修改 webhook/目标后,1-click 验证配置有效。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { getAdapter } from "@/lib/distribution/adapters";
import { Errors, handleError, success } from "@/lib/api/response";

interface TestResult {
  ok: boolean;
  platform: string;
  targetName: string;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    durationMs?: number;
  }>;
  adapterValidation: { valid: boolean; missing: string[] };
  suggestedFix?: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const target = await prisma.distributionTarget.findUnique({
      where: { id: params.id },
    });
    if (!target) throw Errors.notFound("分发目标");
    await requireProjectEditor(session.user.id, session.user.role, target.projectId);

    const checks: TestResult["checks"] = [];
    const config = (target.config ?? {}) as Record<string, unknown>;
    const startedAt = Date.now();

    // Step 1: 适配器配置校验
    const adapter = getAdapter(target.platform as any);
    const validation = adapter ? adapter.validateConfig(config) : { valid: true, missing: [] };
    checks.push({
      name: "配置校验",
      passed: validation.valid,
      message: validation.valid
        ? "所有必填字段已配置"
        : `缺失字段: ${validation.missing.join(", ")}`,
    });

    // Step 2: 平台特定的可达性测试
    if (target.platform === "CUSTOM_WEBHOOK" && typeof config.url === "string") {
      const url = config.url;
      try {
        const headStart = Date.now();
        // 先 HEAD,失败再 GET
        let res: Response;
        try {
          res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        } catch {
          res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
        }
        const ms = Date.now() - headStart;
        checks.push({
          name: "Webhook 可达",
          passed: res.ok || res.status < 500,
          message: `${res.status} ${res.statusText}`,
          durationMs: ms,
        });
        if (!res.ok && res.status >= 500) {
          checks.push({
            name: "建议",
            passed: false,
            message: "服务端返回 5xx,检查目标 endpoint 是否运行",
          });
        }
      } catch (e: any) {
        checks.push({
          name: "Webhook 可达",
          passed: false,
          message: e.message?.slice(0, 100) ?? "连接失败",
        });
      }
    } else if (validation.valid && adapter) {
      // 其他平台:验证配置 + 模拟一次 dry-run (不实际发送)
      const fakeInput = {
        title: "[Test] Connection Test",
        content: "This is a connection test from GEO-SEO. No action needed.",
        excerpt: "Connection test",
        url: "https://example.com",
      };
      try {
        // 真实试分发到测试服务器 — 这里只测解析/网络可达,实际发送会被远端接收
        // 对 web platform, 主动跳过以避免发到真实平台
        if (target.platform === "ZHIHU" || target.platform === "WECHAT_MP" ||
            target.platform === "FEISHU_DOC" || target.platform === "BAIJIAHAO" ||
            target.platform === "DOUYIN" || target.platform === "XIAOHONGSHU" ||
            target.platform === "NOTION" || target.platform === "DINGTALK") {
          checks.push({
            name: "认证检查",
            passed: Boolean(config.token || config.appId || config.apiKey),
            message: config.token || config.appId || config.apiKey
              ? "认证凭据已配置(无法在不发送的情况下深度验证)"
              : "缺少认证凭据(token/appId/apiKey)",
          });
        } else if (target.platform === "BAIDU_SEARCH" || target.platform === "SOGOU_SEARCH" ||
                   target.platform === "SO360_SEARCH" || target.platform === "SHENMA_SEARCH") {
          // 搜索引擎:检查 site 字段
          checks.push({
            name: "站点字段",
            passed: Boolean(config.site || config.domain),
            message: config.site || config.domain
              ? `已配置站点: ${config.site ?? config.domain}`
              : "请填写 site/domain 字段(您的网站)",
          });
        } else if (target.platform === "COZE" || target.platform === "BAIDU_WENXIN" ||
                   target.platform === "TENCENT_YUANBAO") {
          checks.push({
            name: "Bot ID",
            passed: Boolean(config.botId || config.appId),
            message: config.botId || config.appId
              ? "Bot ID 已配置"
              : "请填写 botId/appId 字段",
          });
        } else if (target.platform === "CITATION_SITE" || target.platform === "INDEX_SITE") {
          checks.push({
            name: "收录 URL",
            passed: Boolean(config.submitUrl || config.url),
            message: config.submitUrl || config.url
              ? "提交 URL 已配置"
              : "请填写 submitUrl 字段",
          });
        } else {
          checks.push({
            name: "通用校验",
            passed: true,
            message: "未提供专门的连通性测试,请检查配置后手动试发",
          });
        }
      } catch (e: any) {
        checks.push({
          name: "通用校验",
          passed: false,
          message: e.message?.slice(0, 100) ?? "校验失败",
        });
      }
    }

    const ok = checks.every((c) => c.passed);
    const suggestedFix = ok
      ? undefined
      : checks.find((c) => !c.passed)?.message ?? "请检查目标配置";

    const result: TestResult = {
      ok,
      platform: target.platform,
      targetName: target.name,
      checks,
      adapterValidation: validation,
      suggestedFix,
    };

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "DistributionTarget",
      targetId: target.id,
      metadata: { action: "test-connection", ok, durationMs: Date.now() - startedAt },
    });

    return success(result);
  } catch (err) {
    return handleError(err);
  }
}
