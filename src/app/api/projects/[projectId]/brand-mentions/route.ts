import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { handleError, success } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "50");
    const mentionType = url.searchParams.get("type");

    const mentions = await prisma.brandMention.findMany({
      where: {
        projectId: params.projectId,
        ...(mentionType && { mentionType: mentionType as "primary_brand" | "competitor" }),
      },
      orderBy: { discoveredAt: "desc" },
      take: limit,
    });

    return success(mentions);
  } catch (err) {
    return handleError(err);
  }
}
