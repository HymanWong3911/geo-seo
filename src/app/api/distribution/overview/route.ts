// 分发总览：列出所有项目最近分发日志、成功率、状态分布。
// GET /api/distribution/overview?days=30
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "30"), 90);
    const since = new Date(Date.now() - days * DAY);

    // 仅返回用户有权限的项目的分发日志
    let projectIds: string[];
    if (session.user.role === "ADMIN") {
      const all = await prisma.project.findMany({ select: { id: true } });
      projectIds = all.map((p) => p.id);
    } else {
      const memberships = await prisma.userProject.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      });
      projectIds = memberships.map((m) => m.projectId);
    }

    const logs = await prisma.distributionLog.findMany({
      where: {
        target: { projectId: { in: projectIds } },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        target: {
          select: {
            id: true,
            name: true,
            platform: true,
            project: { select: { id: true, name: true, domain: true } },
          },
        },
        draft: { select: { id: true, title: true, status: true } },
      },
    });

    // 按项目/平台聚合
    const byProject = new Map<string, { project: any; total: number; success: number; failed: number; pending: number }>();
    const byPlatform = new Map<string, { platform: string; total: number; success: number }>();

    for (const l of logs) {
      const pid = l.target.project.id;
      const ps = byProject.get(pid) ?? {
        project: l.target.project,
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
      };
      ps.total++;
      if (l.status === "SUCCESS") ps.success++;
      else if (l.status === "FAILED") ps.failed++;
      else if (l.status === "PENDING") ps.pending++;
      byProject.set(pid, ps);

      const platform = l.target.platform;
      const pp = byPlatform.get(platform) ?? { platform, total: 0, success: 0 };
      pp.total++;
      if (l.status === "SUCCESS") pp.success++;
      byPlatform.set(platform, pp);
    }

    return success({
      days,
      totals: {
        total: logs.length,
        success: logs.filter((l) => l.status === "SUCCESS").length,
        failed: logs.filter((l) => l.status === "FAILED").length,
        pending: logs.filter((l) => l.status === "PENDING").length,
        successRate: logs.length > 0
          ? Math.round((logs.filter((l) => l.status === "SUCCESS").length / logs.length) * 100)
          : 0,
      },
      byProject: Array.from(byProject.values()),
      byPlatform: Array.from(byPlatform.values()).map((p) => ({
        ...p,
        successRate: p.total > 0 ? Math.round((p.success / p.total) * 100) : 0,
      })),
      recent: logs.slice(0, 50),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}