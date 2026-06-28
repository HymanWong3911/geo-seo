// 读取单个审计详情 + Markdown 导出。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { generateRecommendations } from "@/lib/seo/recommendations";
import { renderAuditMarkdown } from "@/lib/seo/markdownExport";
import type { Finding } from "@/lib/seo/analyzer";
import { Errors, handleError, success } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const audit = await prisma.pageAudit.findUnique({
      where: { id: params.id },
      include: { page: true },
    });
    if (!audit) throw Errors.notFound("审计");

    await requireProjectEditor(
      session.user.id,
      session.user.role,
      audit.page.projectId,
    );

    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    if (format === "md") {
      const findings = (audit.findings as unknown as Finding[]) ?? [];
      const recommendations = generateRecommendations({
        url: audit.page.url,
        findings,
      });
      const snapshot = (audit.rawSnapshot as any) ?? {};
      const md = renderAuditMarkdown({
        url: audit.page.url,
        title: audit.page.title,
        score: audit.score,
        statusCode: audit.statusCode,
        indexable: audit.indexable,
        findings,
        recommendations,
        performance: snapshot.performance ?? null,
        snapshot,
        generatedAt: audit.createdAt,
      });
      return new NextResponse(md, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-${audit.id}.md"`,
        },
      });
    }

    return success(audit);
  } catch (err) {
    return handleError(err);
  }
}
