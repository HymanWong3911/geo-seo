// 批量导入关键词。
// 支持 JSON 格式或简单 CSV（每行：text,intent,priority）。
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { audit } from "@/lib/audit/logger";
import { importKeywordsSchema, createKeywordSchema } from "@/lib/api/validators/keyword";
import { SearchIntent } from "@prisma/client";
import { Errors, handleError, created } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const body = await req.json();
    const parsed = importKeywordsSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.badRequest("参数错误", parsed.error.flatten());
    }

    let items;
    if (parsed.data.format === "json") {
      items = parsed.data.items;
    } else {
      // 简单 CSV 解析
      const lines = parsed.data.csv.trim().split(/\r?\n/);
      const header = lines[0].split(",").map((s) => s.trim());
      if (header[0] !== "text") {
        throw Errors.badRequest("CSV 第一列必须为 text");
      }
      items = lines.slice(1).map((line) => {
        const cols = line.split(",").map((s) => s.trim());
        return createKeywordSchema.parse({
          text: cols[0],
          intent: (cols[1] || "INFORMATIONAL") as SearchIntent,
          priority: cols[2] ? parseInt(cols[2]) : 3,
        });
      });
    }

    const result = await prisma.keyword.createMany({
      data: items.map((item) => ({
        ...item,
        targetUrl: item.targetUrl ?? null,
        projectId: params.projectId,
      })),
    });

    await audit("KEYWORD_IMPORTED", {
      userId: session.user.id,
      targetType: "Project",
      targetId: params.projectId,
      metadata: { count: result.count, format: parsed.data.format },
    });

    return created({ count: result.count });
  } catch (err) {
    return handleError(err);
  }
}
