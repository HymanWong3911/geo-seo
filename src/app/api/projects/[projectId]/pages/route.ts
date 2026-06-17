// 列出项目下的所有已抓取页面。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { Errors, handleError, paginated } from "@/lib/api/response";

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
    const search = url.searchParams.get("search") ?? "";

    const where = {
      projectId: params.projectId,
      ...(search
        ? {
            OR: [
              { url: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [pages, total] = await Promise.all([
      prisma.page.findMany({
        where,
        orderBy: { lastCrawledAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { audits: true } },
          audits: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, score: true, createdAt: true },
          },
        },
      }),
      prisma.page.count({ where }),
    ]);

    return paginated(pages, total, page, pageSize);
  } catch (err) {
    return handleError(err);
  }
}
