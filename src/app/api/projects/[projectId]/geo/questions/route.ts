// GEO 问题库列表 + 创建。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { createGeoQuestionSchema } from "@/lib/api/validators/geo";
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
    const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "50"), 200);
    const active = url.searchParams.get("active");
    const search = url.searchParams.get("search") ?? "";

    const where = {
      projectId: params.projectId,
      ...(active === "true" ? { active: true } : {}),
      ...(active === "false" ? { active: false } : {}),
      ...(search ? { question: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [questions, total] = await Promise.all([
      prisma.geoQuestion.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.geoQuestion.count({ where }),
    ]);

    return paginated(questions, total, page, pageSize);
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
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = createGeoQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const question = await prisma.geoQuestion.create({
      data: {
        ...parsed.data,
        projectId: params.projectId,
      },
    });

    await audit("GEO_QUESTION_CREATE", {
      userId: session.user.id,
      targetType: "GeoQuestion",
      targetId: question.id,
      metadata: { projectId: params.projectId, question: question.question },
    });

    return created(question);
  } catch (err) {
    return handleError(err);
  }
}
