// 告警事件历史。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, paginated } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);
    const eventType = url.searchParams.get("eventType");
    const status = url.searchParams.get("status");

    const where: Prisma.AlertEventWhereInput = {
      ...(eventType ? { eventType: eventType as Prisma.AlertEventWhereInput["eventType"] } : {}),
      ...(status ? { status: status as Prisma.AlertEventWhereInput["status"] } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.alertEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { channel: { select: { name: true, type: true } } },
      }),
      prisma.alertEvent.count({ where }),
    ]);

    return paginated(events, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}
