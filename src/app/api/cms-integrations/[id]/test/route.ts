// 测试 CMS 集成连接。
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { prisma } from "@/lib/db";
import { adapterForIntegration } from "@/lib/cms/integration";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
    const integration = await prisma.cmsIntegration.findUnique({ where: { id: params.id } });
    if (!integration) throw Errors.notFound("CMS 集成");

    const adapter = adapterForIntegration(integration);
    const categories = await adapter.listCategories();

    return success({
      ok: true,
      adapter: adapter.name,
      categoriesCount: categories.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
