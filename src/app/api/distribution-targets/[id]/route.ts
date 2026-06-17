// 分发目标更新 / 删除。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { DistributionPlatform, Prisma } from "@prisma/client";
import { Errors, handleError, success } from "@/lib/api/response";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  platform: z.nativeEnum(DistributionPlatform).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

async function loadTarget(id: string) {
  const t = await prisma.distributionTarget.findUnique({ where: { id } });
  if (!t) throw Errors.notFound("分发目标");
  return t;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const target = await loadTarget(params.id);
    await requireProjectEditor(session.user.id, session.user.role, target.projectId);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const data: Prisma.DistributionTargetUpdateInput = {
      name: parsed.data.name,
      platform: parsed.data.platform,
      active: parsed.data.active,
    };
    if (parsed.data.config) {
      data.config = parsed.data.config as Prisma.InputJsonValue;
    }

    const updated = await prisma.distributionTarget.update({
      where: { id: target.id },
      data,
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "DistributionTarget",
      targetId: target.id,
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
    const session = await requireSession();
    const target = await loadTarget(params.id);
    await requireProjectEditor(session.user.id, session.user.role, target.projectId);

    await prisma.distributionTarget.delete({ where: { id: target.id } });

    await audit("DATA_DELETE", {
      userId: session.user.id,
      targetType: "DistributionTarget",
      targetId: target.id,
      metadata: { action: "delete", name: target.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
