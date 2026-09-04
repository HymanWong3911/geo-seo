// CMS 集成更新 / 删除。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";
import { Prisma } from "@prisma/client";
import { encryptSecret, fingerprintSecret } from "@/lib/security/secrets";
import { publicCmsIntegration } from "@/lib/cms/integration";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["self-hosted", "mock"]).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(8, "API Key 至少 8 位").optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin();
    const integration = await prisma.cmsIntegration.findUnique({ where: { id: params.id } });
    if (!integration) throw Errors.notFound("CMS 集成");

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const data: Prisma.CmsIntegrationUpdateInput = {
      name: parsed.data.name,
      type: parsed.data.type,
      baseUrl: parsed.data.baseUrl,
      active: parsed.data.active,
    };
    if (parsed.data.config) {
      data.config = parsed.data.config as Prisma.InputJsonValue;
    }
    if (parsed.data.apiKey) {
      const secret = encryptSecret(parsed.data.apiKey);
      data.apiKeyHash = fingerprintSecret(parsed.data.apiKey);
      data.apiKeyEncrypted = secret.encrypted;
      data.apiKeyIv = secret.iv;
      data.apiKeyTag = secret.tag;
    }

    const updated = await prisma.cmsIntegration.update({
      where: { id: integration.id },
      data,
    });

    await audit("SETTINGS_UPDATE", {
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: { action: "update", changes: Object.keys(parsed.data) },
    });

    return success(publicCmsIntegration(updated));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireAdmin();
    const integration = await prisma.cmsIntegration.findUnique({ where: { id: params.id } });
    if (!integration) throw Errors.notFound("CMS 集成");

    const publishLogCount = await prisma.publishLog.count({
      where: { cmsIntegrationId: integration.id },
    });

    if (publishLogCount > 0) {
      await prisma.cmsIntegration.update({
        where: { id: integration.id },
        data: { active: false },
      });
    } else {
      await prisma.cmsIntegration.delete({ where: { id: integration.id } });
    }

    await audit("SETTINGS_UPDATE", {
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: {
        action: publishLogCount > 0 ? "archive" : "delete",
        name: integration.name,
        publishLogCount,
      },
    });

    return success({ ok: true, archived: publishLogCount > 0 });
  } catch (err) {
    return handleError(err);
  }
}
