// 立即触发品牌扫描。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { monitorBrand } from "@/lib/brand/monitor";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: { brands: true, competitors: true },
    });
    if (!project) throw Errors.notFound("项目");

    if (project.brands.length === 0) {
      throw Errors.badRequest("项目还没有主品牌，请先到「品牌与竞品」添加");
    }

    const primaryBrand = project.brands.find((b) => b.isPrimary);
    if (!primaryBrand) {
      throw Errors.badRequest("项目还没有主品牌（isPrimary=true），请先标记一个");
    }

    const brandAliases = [primaryBrand.name, ...primaryBrand.aliases];
    const competitorNames = project.competitors.map((c) => c.name);

    const results = await monitorBrand({
      projectId: params.projectId,
      brands: brandAliases,
      competitors: competitorNames,
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "Project",
      targetId: params.projectId,
      metadata: { action: "brand-monitor", count: results.length },
    });

    return success({ count: results.length, mentions: results.slice(0, 10) });
  } catch (err) {
    return handleError(err);
  }
}
