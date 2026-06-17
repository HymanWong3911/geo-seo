// 测试 CMS 集成连接。
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { cmsAdapter } from "@/lib/cms";
import { handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();

    // 简单测试：尝试列出 categories
    const categories = await cmsAdapter.listCategories();

    return success({
      ok: true,
      adapter: cmsAdapter.name,
      categoriesCount: categories.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
