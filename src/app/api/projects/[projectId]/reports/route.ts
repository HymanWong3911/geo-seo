// 报告列表 + 创建。
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { generateReport } from "@/lib/reports/generator";
import { ReportType } from "@prisma/client";
import { Errors, handleError, paginated, created } from "@/lib/api/response";

const createSchema = z.object({
  type: z.nativeEnum(ReportType),
  fromDays: z.number().int().min(1).max(180).optional(),
  auditId: z.string().optional(),
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
    const type = url.searchParams.get("type");

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: {
          projectId: params.projectId,
          ...(type ? { type: type as never } : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          periodFrom: true,
          periodTo: true,
          auditId: true,
          generatedBy: true,
          createdAt: true,
          // 不返回 content，太多
        },
      }),
      prisma.report.count({
        where: { projectId: params.projectId, ...(type ? { type: type as never } : {}) },
      }),
    ]);

    return paginated(reports, total, page, pageSize);
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

    if (parsed.data.type === "AUDIT" && !parsed.data.auditId) {
      throw Errors.badRequest("AUDIT 报告必须提供 auditId");
    }

    // 生成报告
    const markdown = await generateReport({
      projectId: params.projectId,
      type: parsed.data.type,
      fromDays: parsed.data.fromDays,
      auditId: parsed.data.auditId,
    });

    const now = new Date();
    const fromDays = parsed.data.fromDays ?? (parsed.data.type === "MONTHLY" ? 30 : 7);
    const periodFrom = new Date(now.getTime() - fromDays * 24 * 3600 * 1000);

    const report = await prisma.report.create({
      data: {
        projectId: params.projectId,
        type: parsed.data.type,
        periodFrom,
        periodTo: now,
        auditId: parsed.data.auditId,
        content: markdown,
        generatedBy: session.user.id,
      },
    });

    await audit("REPORT_EXPORT", {
      userId: session.user.id,
      targetType: "Report",
      targetId: report.id,
      metadata: { type: report.type, projectId: params.projectId },
    });

    return created({
      id: report.id,
      type: report.type,
      createdAt: report.createdAt,
    });
  } catch (err) {
    return handleError(err);
  }
}
