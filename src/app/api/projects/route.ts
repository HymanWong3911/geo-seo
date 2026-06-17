// 项目列表 + 创建。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, listUserProjectIds } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { createProjectSchema } from "@/lib/api/validators/project";
import { Errors, handleError, paginated, created } from "@/lib/api/response";
import { ProjectStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);
    const archived = url.searchParams.get("archived") === "true";

    const allowedIds = await listUserProjectIds(session.user.id, session.user.role);

    const where = {
      id: { in: allowedIds },
      status: archived ? ProjectStatus.ARCHIVED : ProjectStatus.ACTIVE,
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ]);

    return paginated(projects, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") {
      throw Errors.forbidden("只有 ADMIN 可以创建项目");
    }

    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const project = await prisma.project.create({
      data: parsed.data,
    });

    // 创建者成为 OWNER
    await prisma.userProject.create({
      data: {
        userId: session.user.id,
        projectId: project.id,
        role: "OWNER",
      },
    });

    await audit("PROJECT_CREATE", {
      userId: session.user.id,
      targetType: "Project",
      targetId: project.id,
      metadata: { name: project.name, domain: project.domain },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return created(project);
  } catch (err) {
    return handleError(err);
  }
}
