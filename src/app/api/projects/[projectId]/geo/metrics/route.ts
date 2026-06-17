// 项目 GEO 指标（7 天滚动）。
import { NextRequest } from "next/server";
import { requireSession, requireProjectEditor } from "@/lib/api/auth";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";
import { handleError, success } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  try {
    const session = await requireSession();
    await requireProjectEditor(session.user.id, session.user.role, params.projectId);
    const metrics = await calculateProjectGeoMetrics(params.projectId);
    return success(metrics);
  } catch (err) {
    return handleError(err);
  }
}
