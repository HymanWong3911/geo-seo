import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { Errors, handleError, success } from "@/lib/api/response";
import { generatePdfFromHtml, markdownToHtml } from "@/lib/reports/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const report = await prisma.report.findUnique({ where: { id: params.id } });
    if (!report) throw Errors.notFound("报告");

    await requireProjectEditor(session.user.id, session.user.role, report.projectId);

    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    if (format === "md") {
      return new NextResponse(report.content, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${report.id}.md"`,
        },
      });
    }

    if (format === "pdf") {
      const html = markdownToHtml(report.content, `${report.type} Report`);
      const pdfBuffer = await generatePdfFromHtml(html);
      
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="report-${report.id}.pdf"`,
        },
      });
    }

    return success(report);
  } catch (err) {
    return handleError(err);
  }
}
