import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { generateRecommendations, createOptimizationTasks } from "@/lib/seo/recommendations";
import type { Finding } from "@/lib/seo/analyzer";
import { handleError, success } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const audit = await prisma.pageAudit.findUnique({
      where: { id: params.id },
      include: {
        page: { select: { projectId: true, url: true } },
      },
    });
    
    if (!audit) {
      return NextResponse.json({ error: { message: "审计不存在" } }, { status: 404 });
    }

    await requireProjectEditor(session.user.id, session.user.role, audit.page.projectId);

    const findings = audit.findings as unknown as Finding[];
    const recommendations = generateRecommendations({
      url: audit.page.url,
      findings,
    });

    return success({
      auditId: params.id,
      url: audit.page.url,
      score: audit.score,
      findingsCount: findings.length,
      recommendations,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireSession();
    const audit = await prisma.pageAudit.findUnique({
      where: { id: params.id },
      include: {
        page: { select: { projectId: true, url: true } },
      },
    });

    if (!audit) {
      return NextResponse.json({ error: { message: "审计不存在" } }, { status: 404 });
    }

    await requireProjectEditor(session.user.id, session.user.role, audit.page.projectId);

    const body = await req.json();
    const { createTasks = true, minSeverity = "medium" } = body;

    const findings = audit.findings as unknown as Finding[];
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const filteredFindings = findings.filter(f => 
      severityOrder[f.severity] <= (severityOrder[minSeverity] ?? 1)
    );

    const recommendations = generateRecommendations({
      url: audit.page.url,
      findings: filteredFindings,
    });

    let tasksCreated = 0;
    if (createTasks) {
      const tasks = await createOptimizationTasks(
        audit.page.projectId,
        audit.page.url,
        filteredFindings
      );

      for (const task of tasks) {
        await prisma.optimizationTask.create({
          data: {
            projectId: audit.page.projectId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            url: task.url,
            sourceType: "SEO_AUDIT",
            sourceId: params.id,
            status: "TODO",
          },
        });
        tasksCreated++;
      }
    }

    return success({
      recommendationsGenerated: recommendations.length,
      tasksCreated,
    });
  } catch (err) {
    return handleError(err);
  }
}
