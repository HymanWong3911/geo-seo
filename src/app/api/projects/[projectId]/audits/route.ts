// 创建页面审计 + 列出项目下的审计。
// 详细说明见 dev doc v1.2 9.4 节。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { runPageAuditSync } from "@/workers/pageAuditWorker";
import { Errors, handleError, paginated, created } from "@/lib/api/response";

const createSchema = z.object({
  url: z.string().url(),
  sync: z.boolean().default(false),  // 同步跑（dev 用），否则入队
});

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

    const [audits, total] = await Promise.all([
      prisma.pageAudit.findMany({
        where: { page: { projectId: params.projectId } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          page: { select: { id: true, url: true, title: true } },
        },
      }),
      prisma.pageAudit.count({
        where: { page: { projectId: params.projectId } },
      }),
    ]);

    return paginated(audits, total, page, pageSize);
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    if (!project) throw Errors.notFound("项目");

    // 域名校验：必须属于项目域名
    try {
      const target = new URL(parsed.data.url);
      const projectDomain = project.domain.replace(/^www\./, "");
      const targetDomain = target.hostname.replace(/^www\./, "");
      if (projectDomain && !targetDomain.endsWith(projectDomain)) {
        throw Errors.badRequest(
          `URL 域名 ${targetDomain} 不属于项目域名 ${projectDomain}`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("不属于")) throw err;
      throw Errors.badRequest("URL 格式错误");
    }

    if (parsed.data.sync) {
      // 同步执行（dev / 快速审计）
      const result = await runPageAuditSync({
        projectId: params.projectId,
        url: parsed.data.url,
        userId: session.user.id,
        triggerType: "MANUAL",
      });
      return created({
        auditId: result.auditId,
        pageId: result.pageId,
        score: result.score,
        findingsCount: result.findingsCount,
        findings: result.findings,
        sync: true,
      });
    }

    // 异步入队
    const { enqueuePageAudit } = await import("@/lib/queue/audit");
    const job = await enqueuePageAudit({
      projectId: params.projectId,
      url: parsed.data.url,
      userId: session.user.id,
      triggerType: "MANUAL",
    });

    return created({ jobId: job.id, status: "PENDING", sync: false });
  } catch (err) {
    return handleError(err);
  }
}
