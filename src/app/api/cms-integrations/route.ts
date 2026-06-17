// CMS 集成列表 + 创建。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success, created } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

const createSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(100),
  type: z.string().default("self-hosted"),
  baseUrl: z.string().url(),
  apiKey: z.string().min(8, "API Key 至少 8 位"),
  config: z.record(z.string(), z.unknown()).default({}),
  active: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();
    const integrations = await prisma.cmsIntegration.findMany({
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, name: true } } },
    });
    return success(integrations);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 存 API Key 哈希（不存明文）
    const apiKeyHash = crypto
      .createHash("sha256")
      .update(parsed.data.apiKey)
      .digest("hex");

    const integration = await prisma.cmsIntegration.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        type: parsed.data.type,
        baseUrl: parsed.data.baseUrl,
        apiKeyHash,
        config: parsed.data.config as Prisma.InputJsonValue,
        active: parsed.data.active,
      },
    });

    await audit("ALERT_CHANNEL_UPDATE", {
      // 复用：v1.1 没 CMS_INTEGRATION_CREATE
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: { action: "create", name: integration.name, type: integration.type },
    });

    return created(integration);
  } catch (err) {
    return handleError(err);
  }
}
