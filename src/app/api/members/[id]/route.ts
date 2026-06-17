// 更新 / 删除单个成员。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectOwner } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateMemberSchema } from "@/lib/api/validators/project";
import { Errors, handleError, success } from "@/lib/api/response";

async function loadMembershipOr404(id: string) {
  const membership = await prisma.userProject.findUnique({
    where: { id },
  });
  if (!membership) throw Errors.notFound("成员关系");
  return membership;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const membership = await loadMembershipOr404(params.id);
    await requireProjectOwner(session.user.id, session.user.role, membership.projectId);

    const body = await req.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const updated = await prisma.userProject.update({
      where: { id: membership.id },
      data: { role: parsed.data.role },
    });

    await audit("PROJECT_MEMBER_UPDATE", {
      userId: session.user.id,
      targetType: "UserProject",
      targetId: membership.id,
      metadata: { newRole: parsed.data.role },
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const membership = await loadMembershipOr404(params.id);
    await requireProjectOwner(session.user.id, session.user.role, membership.projectId);

    // 不能移除最后一个 OWNER
    const ownerCount = await prisma.userProject.count({
      where: { projectId: membership.projectId, role: "OWNER" },
    });
    if (membership.role === "OWNER" && ownerCount <= 1) {
      throw Errors.badRequest("项目至少需要 1 个 OWNER");
    }

    await prisma.userProject.delete({ where: { id: membership.id } });

    await audit("PROJECT_MEMBER_REMOVE", {
      userId: session.user.id,
      targetType: "UserProject",
      targetId: membership.id,
      metadata: { projectId: membership.projectId, userId: membership.userId },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
