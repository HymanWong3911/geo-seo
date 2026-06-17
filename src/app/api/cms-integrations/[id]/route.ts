// CMS 集成更新 / 删除。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { cmsAdapter } from "@/lib/cms";
import { Errors, handleError, success } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
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
      baseUrl: parsed.data.baseUrl,
      active: parsed.data.active,
    };
    if (parsed.data.config) {
      data.config = parsed.data.config as Prisma.InputJsonValue;
    }

    const updated = await prisma.cmsIntegration.update({
      where: { id: integration.id },
      data,
    });

    await audit("ALERT_CHANNEL_UPDATE", {
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: { action: "update", changes: Object.keys(parsed.data) },
    });

    return success(updated);
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

    await prisma.cmsIntegration.delete({ where: { id: integration.id } });

    await audit("ALERT_CHANNEL_UPDATE", {
      userId: session.user.id,
      targetType: "CmsIntegration",
      targetId: integration.id,
      metadata: { action: "delete", name: integration.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
