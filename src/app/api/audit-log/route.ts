// 审计日志查询。
// ADMIN 看全量，MEMBER 仅看与自己相关。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, paginated } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "50"), 200);
    const action = url.searchParams.get("action");
    const targetType = url.searchParams.get("targetType");

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action: action as Prisma.EnumAuditActionFilter } : {}),
      ...(targetType ? { targetType } : {}),
      // MEMBER 只能看自己的；ADMIN 看全部
      ...(session.user.role !== "ADMIN" ? { userId: session.user.id } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginated(logs, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}
