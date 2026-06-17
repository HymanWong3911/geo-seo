// 关键词列表 + 创建。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { createKeywordSchema } from "@/lib/api/validators/keyword";
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
    const search = url.searchParams.get("search") ?? "";
    const intent = url.searchParams.get("intent");

    const where = {
      projectId: params.projectId,
      ...(search ? { text: { contains: search, mode: "insensitive" as const } } : {}),
      ...(intent ? { intent: intent as never } : {}),
    };

    const [keywords, total] = await Promise.all([
      prisma.keyword.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.keyword.count({ where }),
    ]);

    return paginated(keywords, total, page, pageSize);
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
    const parsed = createKeywordSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const keyword = await prisma.keyword.create({
      data: {
        ...parsed.data,
        targetUrl: parsed.data.targetUrl ?? null,
        projectId: params.projectId,
      },
    });

    await audit("KEYWORD_CREATE", {
      userId: session.user.id,
      targetType: "Keyword",
      targetId: keyword.id,
      metadata: { projectId: params.projectId, text: keyword.text },
    });

    return created(keyword);
  } catch (err) {
    return handleError(err);
  }
}
