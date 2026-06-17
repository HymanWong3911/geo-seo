// 读取单个审计详情。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const audit = await prisma.pageAudit.findUnique({
      where: { id: params.id },
      include: { page: true },
    });
    if (!audit) throw Errors.notFound("审计");

    await requireProjectEditor(
      session.user.id,
      session.user.role,
      audit.page.projectId,
    );

    return success(audit);
  } catch (err) {
    return handleError(err);
  }
}
