// 品牌列表 + 创建。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { createBrandSchema } from "@/lib/api/validators/geo";
import { Errors, handleError, success, created } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const brands = await prisma.brand.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });

    return success(brands);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = createBrandSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    // 如果设为 primary，先把其他 primary 取消
    if (parsed.data.isPrimary) {
      await prisma.brand.updateMany({
        where: { projectId: params.projectId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const brand = await prisma.brand.create({
      data: {
        ...parsed.data,
        projectId: params.projectId,
      },
    });

    await audit("BRAND_CREATE", {
      userId: session.user.id,
      targetType: "Brand",
      targetId: brand.id,
      metadata: { projectId: params.projectId, name: brand.name, isPrimary: brand.isPrimary },
    });

    return created(brand);
  } catch (err) {
    return handleError(err);
  }
}
