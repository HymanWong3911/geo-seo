// 单个项目读取 / 更新 / 删除。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireSession,
  requireProjectEditor,
  requireProjectOwner,
  requireAdmin,
} from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { updateProjectSchema } from "@/lib/api/validators/project";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        _count: {
          select: {
            geoQuestions: true,
            keywords: true,
            brands: true,
            competitors: true,
            members: true,
            pages: true,
            tasks: true,
            geoRuns: true,
            brandMentions: true,
            distributionTargets: true,
          },
        },
      },
    });
    if (!project) throw Errors.notFound("项目");

    return success(project);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectOwner(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });
    if (!project) throw Errors.notFound("项目");

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: parsed.data,
    });

    await audit("PROJECT_UPDATE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: project.id,
      metadata: { changes: Object.keys(parsed.data) },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return success(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    // 仅 ADMIN 可硬删项目
    requireAdmin();

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });
    if (!project) throw Errors.notFound("项目");

    // 级联删除由 Prisma schema onDelete: Cascade 处理
    await prisma.project.delete({ where: { id: project.id } });

    await audit("PROJECT_UPDATE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: project.id,
      metadata: { action: "hard_delete", name: project.name },
    });

    return success({ ok: true, deletedId: project.id });
  } catch (err) {
    return handleError(err);
  }
}
