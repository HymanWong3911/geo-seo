// 标记单条通知已读。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const n = await prisma.notification.findUnique({ where: { id: params.id } });
    if (!n) throw Errors.notFound("通知");
    if (n.userId !== session.user.id) throw Errors.forbidden();

    await prisma.notification.update({
      where: { id: n.id },
      data: { read: true, readAt: new Date() },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
