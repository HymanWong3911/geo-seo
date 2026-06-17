// 列出 / 添加项目成员。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectOwner } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { addMemberSchema } from "@/lib/api/validators/project";
import { Errors, handleError, success, created } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectOwner(session.user.id, session.user.role, params.projectId);

    const members = await prisma.userProject.findMany({
      where: { projectId: params.projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            active: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return success(members);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectOwner(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) throw Errors.notFound("用户");
    if (!user.active) throw Errors.badRequest("用户已停用");

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });
    if (!project) throw Errors.notFound("项目");

    const existing = await prisma.userProject.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
    });
    if (existing) {
      throw Errors.conflict("用户已是项目成员");
    }

    const membership = await prisma.userProject.create({
      data: {
        userId: user.id,
        projectId: project.id,
        role: parsed.data.role,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    await audit("PROJECT_MEMBER_ADD", {
      userId: session.user.id,
      targetType: "UserProject",
      targetId: membership.id,
      metadata: { projectId: project.id, memberId: user.id, role: parsed.data.role },
    });

    return created(membership);
  } catch (err) {
    return handleError(err);
  }
}
