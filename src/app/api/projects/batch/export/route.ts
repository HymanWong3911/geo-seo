// CSV 导出项目数据。
// GET /api/projects/batch/export?ids=id1,id2&type=keywords|tasks|brands
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api/auth";
import { Errors, handleError } from "@/lib/api/response";
import { requireProjectEditor } from "@/lib/api/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
    const type = req.nextUrl.searchParams.get("type") ?? "keywords";

    if (ids.length === 0) {
      throw Errors.badRequest("ids 不能为空");
    }

    // 权限检查：所有项目都要有权
    for (const id of ids) {
      await requireProjectEditor(session.user.id, session.user.role, id);
    }

    let csv = "";
    if (type === "keywords") {
      const rows = await prisma.keyword.findMany({ where: { projectId: { in: ids } } });
      csv = "id,projectId,text,language,region,intent,priority,targetUrl,createdAt\n";
      for (const k of rows) {
        csv += [
          k.id, k.projectId, csvField(k.text), k.language, k.region,
          k.intent, k.priority, csvField(k.targetUrl ?? ""), k.createdAt.toISOString(),
        ].join(",") + "\n";
      }
    } else if (type === "tasks") {
      const rows = await prisma.optimizationTask.findMany({ where: { projectId: { in: ids } } });
      csv = "id,projectId,title,status,priority,sourceType,url,assignee,dueDate,createdAt\n";
      for (const t of rows) {
        csv += [
          t.id, t.projectId, csvField(t.title), t.status, t.priority, t.sourceType,
          csvField(t.url ?? ""), csvField(t.assignee ?? ""),
          t.dueDate?.toISOString() ?? "", t.createdAt.toISOString(),
        ].join(",") + "\n";
      }
    } else if (type === "brands") {
      const rows = await prisma.brand.findMany({ where: { projectId: { in: ids } } });
      csv = "id,projectId,name,aliases,products,description,isPrimary\n";
      for (const b of rows) {
        csv += [
          b.id, b.projectId, csvField(b.name),
          csvField(b.aliases.join("|")),
          csvField(b.products.join("|")),
          csvField(b.description ?? ""),
          b.isPrimary,
        ].join(",") + "\n";
      }
    } else {
      throw Errors.badRequest("type 必须是 keywords/tasks/brands");
    }

    // 返回 CSV
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-${type}-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

function csvField(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}