// 单个品牌更新 / 删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateBrandSchema } from "@/lib/api/validators/geo";
import { Errors, handleError, success } from "@/lib/api/response";

async function loadBrand(id: string) {
  const b = await prisma.brand.findUnique({ where: { id } });
  if (!b) throw Errors.notFound("品牌");
  return b;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const brand = await loadBrand(params.id);
    await requireProjectEditor(session.user.id, session.user.role, brand.projectId);

    const body = await req.json();
    const parsed = updateBrandSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 设为 primary 时，先取消其他
    if (parsed.data.isPrimary === true) {
      await prisma.brand.updateMany({
        where: { projectId: brand.projectId, isPrimary: true, NOT: { id: brand.id } },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: parsed.data,
    });

    await audit("BRAND_UPDATE", {
      userId: session.user.id,
      targetType: "Brand",
      targetId: brand.id,
      metadata: { changes: Object.keys(parsed.data) },
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
    const brand = await loadBrand(params.id);
    await requireProjectEditor(session.user.id, session.user.role, brand.projectId);

    await prisma.brand.delete({ where: { id: brand.id } });

    await audit("BRAND_DELETE", {
      userId: session.user.id,
      targetType: "Brand",
      targetId: brand.id,
      metadata: { name: brand.name },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
