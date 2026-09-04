// API 鉴权辅助函数。
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Errors } from "./response";
import type { ProjectRole, UserRole } from "@prisma/client";

const ALL_PROJECT_ROLES: ProjectRole[] = ["OWNER", "EDITOR", "VIEWER"];

export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw Errors.unauthorized();
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw Errors.forbidden("需要 ADMIN 权限");
  return session;
}

export async function getUserProjectRole(
  userId: string,
  userRole: UserRole,
  projectId: string,
): Promise<ProjectRole | null> {
  if (userRole === "ADMIN") return "OWNER";

  const membership = await prisma.userProject.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return membership?.role ?? null;
}

export async function requireProjectRole(
  userId: string,
  userRole: UserRole,
  projectId: string,
  allowed: ProjectRole[],
): Promise<{ role: ProjectRole }> {
  const role = await getUserProjectRole(userId, userRole, projectId);
  if (!role) throw Errors.forbidden("无权访问该项目");
  if (!allowed.includes(role)) {
    throw Errors.forbidden(`需要 ${allowed.join(" / ")} 权限`);
  }
  return { role };
}

export async function requireProjectOwner(userId: string, userRole: UserRole, projectId: string) {
  return requireProjectRole(userId, userRole, projectId, ["OWNER"]);
}

export async function requireProjectEditor(userId: string, userRole: UserRole, projectId: string) {
  return requireProjectRole(userId, userRole, projectId, ["OWNER", "EDITOR"]);
}

export async function requireProjectMember(userId: string, userRole: UserRole, projectId: string) {
  return requireProjectRole(userId, userRole, projectId, ALL_PROJECT_ROLES);
}

export async function listUserProjectIds(userId: string, userRole: UserRole): Promise<string[]> {
  if (userRole === "ADMIN") {
    const all = await prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    return all.map((p) => p.id);
  }
  const memberships = await prisma.userProject.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

/**
 * Resolve the project scope for cross-project endpoints.
 * A requested project must be explicitly accessible; without one, callers are
 * constrained to the projects returned by listUserProjectIds().
 */
export async function resolveAccessibleProjectIds(
  userId: string,
  userRole: UserRole,
  requestedProjectId?: string,
): Promise<string[]> {
  if (requestedProjectId) {
    await requireProjectMember(userId, userRole, requestedProjectId);
    return [requestedProjectId];
  }
  return listUserProjectIds(userId, userRole);
}

export type ProjectScopedTargetType =
  | "Task"
  | "Optimization"
  | "ContentDraft"
  | "PageAudit"
  | "GeoRun"
  | "Project";

/** Resolve collaboration target IDs to their owning project before reading or writing. */
export async function resolveTargetProjectId(
  targetType: string,
  targetId: string,
): Promise<string> {
  let projectId: string | null = null;

  if (targetType === "Task" || targetType === "Optimization") {
    const target = await prisma.optimizationTask.findUnique({
      where: { id: targetId },
      select: { projectId: true },
    });
    projectId = target?.projectId ?? null;
  } else if (targetType === "ContentDraft") {
    const target = await prisma.contentDraft.findUnique({
      where: { id: targetId },
      select: { projectId: true },
    });
    projectId = target?.projectId ?? null;
  } else if (targetType === "PageAudit") {
    const target = await prisma.pageAudit.findUnique({
      where: { id: targetId },
      select: { page: { select: { projectId: true } } },
    });
    projectId = target?.page.projectId ?? null;
  } else if (targetType === "GeoRun") {
    const target = await prisma.geoRun.findUnique({
      where: { id: targetId },
      select: { projectId: true },
    });
    projectId = target?.projectId ?? null;
  } else if (targetType === "Project") {
    const target = await prisma.project.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    projectId = target?.id ?? null;
  } else {
    throw Errors.badRequest("不支持的评论目标类型");
  }

  if (!projectId) throw Errors.notFound("评论目标");
  return projectId;
}
