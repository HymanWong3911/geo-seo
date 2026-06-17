// API 鉴权辅助函数。
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Errors, HttpError } from "./response";
import type { ProjectRole, UserRole } from "@prisma/client";

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
