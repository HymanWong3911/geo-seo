// 项目批量操作。
// POST /api/projects/batch - 批量归档 / 取消归档 / 硬删除（仅 ADMIN）
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireAdmin } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { Errors, handleError, success } from "@/lib/api/response";

const batchSchema = z.object({
  action: z.enum(["archive", "unarchive", "delete"]),
  ids: z.array(z.string()).min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const { action, ids } = parsed.data;

    if (action === "delete") {
      requireAdmin();
    }

    let count = 0;
    if (action === "archive") {
      const res = await prisma.project.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      count = res.count;
    } else if (action === "unarchive") {
      const res = await prisma.project.updateMany({
        where: { id: { in: ids } },
        data: { status: "ACTIVE", archivedAt: null },
      });
      count = res.count;
    } else if (action === "delete") {
      const res = await prisma.project.deleteMany({
        where: { id: { in: ids } },
      });
      count = res.count;
    }

    await audit("PROJECT_UPDATE", {
      userId: session.user.id,
      targetType: "Project",
      metadata: { action: `batch_${action}`, ids, count },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success({ ok: true, action, count });
  } catch (err) {
    return handleError(err);
  }
}