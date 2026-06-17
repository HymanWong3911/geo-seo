// GEO 运行列表 + 手动触发。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { runGeoRunSync } from "@/workers/geoRunWorker";
import { enqueueGeoRun } from "@/lib/queue/geo";
import { Errors, handleError, paginated, created } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "20"), 100);

    const [runs, total] = await Promise.all([
      prisma.geoRun.findMany({
        where: { projectId: params.projectId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { results: true } },
          results: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, providerSource: true },
          },
        },
      }),
      prisma.geoRun.count({ where: { projectId: params.projectId } }),
    ]);

    return paginated(runs, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}

const triggerSchema = z.object({
  questionIds: z.array(z.string()).optional(),
  sync: z.boolean().default(false),  // dev 默认同步
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = triggerSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    if (parsed.data.sync) {
      const result = await runGeoRunSync({
        projectId: params.projectId,
        questionIds: parsed.data.questionIds,
        userId: session.user.id,
        triggerType: "MANUAL",
      });
      return created(result);
    }

    const job = await enqueueGeoRun({
      projectId: params.projectId,
      questionIds: parsed.data.questionIds,
      userId: session.user.id,
      triggerType: "MANUAL",
    });
    return created({ jobId: job.id, status: "PENDING" });
  } catch (err) {
    return handleError(err);
  }
}
