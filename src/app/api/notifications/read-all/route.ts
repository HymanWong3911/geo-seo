// 全部标记已读。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

export async function POST(_req: NextRequest) {
  try {
    const session = await requireSession();
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    return success({ count: result.count });
  } catch (err) {
    return handleError(err);
  }
}
