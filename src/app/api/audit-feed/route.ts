// 跨项目审计 feed（用于 /audits 首页）。
// ADMIN 看所有项目，MEMBER 看自己有权限的项目。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSession();
    const projectIds = await listUserProjectIds(session.user.id, session.user.role);
    if (projectIds.length === 0) {
      return success([]);
    }

    const audits = await prisma.pageAudit.findMany({
      where: { page: { projectId: { in: projectIds } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        page: { select: { id: true, url: true, title: true, projectId: true } },
      },
    });

    return success(audits);
  } catch (err) {
    return handleError(err);
  }
}
