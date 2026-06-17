// 单个任务读取 / 更新 / 删除。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { TaskStatus } from "@prisma/client";
import { Errors, handleError, success } from "@/lib/api/response";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  assignee: z.string().email().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

async function loadTask(id: string) {
  const t = await prisma.optimizationTask.findUnique({ where: { id } });
  if (!t) throw Errors.notFound("任务");
  return t;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const task = await loadTask(params.id);
    await requireProjectEditor(session.user.id, session.user.role, task.projectId);
    return success(task);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const task = await loadTask(params.id);
    await requireProjectEditor(session.user.id, session.user.role, task.projectId);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }

    const updated = await prisma.optimizationTask.update({
      where: { id: task.id },
      data,
    });

    await audit("TASK_UPDATE", {
      userId: session.user.id,
      targetType: "OptimizationTask",
      targetId: task.id,
      metadata: { changes: Object.keys(parsed.data) },
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
    const task = await loadTask(params.id);
    await requireProjectEditor(session.user.id, session.user.role, task.projectId);

    await prisma.optimizationTask.delete({ where: { id: task.id } });

    await audit("TASK_DELETE", {
      userId: session.user.id,
      targetType: "OptimizationTask",
      targetId: task.id,
      metadata: { title: task.title },
    });

    return success({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
