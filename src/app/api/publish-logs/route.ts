// 发布历史。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { handleError, paginated } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);

    const allowedIds = await listUserProjectIds(session.user.id, session.user.role);
    if (allowedIds.length === 0) {
      return paginated([], 0, page, pageSize);
    }

    const [logs, total] = await Promise.all([
      prisma.publishLog.findMany({
        where: {
          draft: { projectId: { in: allowedIds } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          draft: { select: { id: true, title: true, projectId: true } },
          cmsIntegration: { select: { name: true, type: true } },
        },
      }),
      prisma.publishLog.count({
        where: { draft: { projectId: { in: allowedIds } } },
      }),
    ]);

    return paginated(logs, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}
