// 任务列表 + 创建。
// 详细说明见 dev doc v1.2 6.10 节。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor, listUserProjectIds } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { TaskSource, TaskStatus } from "@prisma/client";
import { Errors, handleError, paginated, created } from "@/lib/api/response";

const createSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceType: z.nativeEnum(TaskSource).default("MANUAL"),
  sourceId: z.string().optional(),
  url: z.string().url().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  dueDate: z.string().datetime().optional(),
  assignee: z.string().email().optional(),
});

const batchCreateSchema = z.object({
  projectId: z.string(),
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    sourceType: z.nativeEnum(TaskSource),
    sourceId: z.string().optional(),
    url: z.string().url().optional(),
    priority: z.number().int().min(1).max(5).default(3),
  })).min(1).max(50),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);
    const status = url.searchParams.get("status");
    const projectId = url.searchParams.get("projectId");

    const allowedIds = await listUserProjectIds(session.user.id, session.user.role);

    const where = {
      projectId: projectId ? projectId : { in: allowedIds },
      ...(status ? { status: status as never } : {}),
    };

    const [tasks, total] = await Promise.all([
      prisma.optimizationTask.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { project: { select: { id: true, name: true, domain: true } } },
      }),
      prisma.optimizationTask.count({ where }),
    ]);

    return paginated(tasks, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();

    // 批量创建
    if (body.tasks && Array.isArray(body.tasks)) {
      const parsed = batchCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw Errors.badRequest("参数错误", parsed.error.flatten());
      }
      await requireProjectEditor(session.user.id, session.user.role, parsed.data.projectId);

      const createdTasks = await prisma.$transaction(
        parsed.data.tasks.map((t) =>
          prisma.optimizationTask.create({
            data: {
              projectId: parsed.data.projectId,
              title: t.title,
              description: t.description ?? null,
              sourceType: t.sourceType,
              sourceId: t.sourceId ?? null,
              url: t.url ?? null,
              priority: t.priority,
              status: TaskStatus.TODO,
            },
          }),
        ),
      );

      await audit("TASK_CREATE", {
        userId: session.user.id,
        targetType: "Project",
        targetId: parsed.data.projectId,
        metadata: { batchSize: createdTasks.length, fromAnalysis: true },
      });

      return created({ count: createdTasks.length, tasks: createdTasks });
    }

    // 单个创建
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }
    await requireProjectEditor(session.user.id, session.user.role, parsed.data.projectId);

    const task = await prisma.optimizationTask.create({
      data: {
        projectId: parsed.data.projectId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        sourceType: parsed.data.sourceType,
        sourceId: parsed.data.sourceId ?? null,
        url: parsed.data.url ?? null,
        priority: parsed.data.priority,
        status: TaskStatus.TODO,
        assignee: parsed.data.assignee ?? null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });

    await audit("TASK_CREATE", {
      userId: session.user.id,
      targetType: "OptimizationTask",
      targetId: task.id,
      metadata: { title: task.title, sourceType: task.sourceType },
    });

    return created(task);
  } catch (err) {
    return handleError(err);
  }
}
