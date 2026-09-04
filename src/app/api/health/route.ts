// Public liveness endpoint.
// Keep this intentionally dependency-free: readiness and operational details
// belong to the ADMIN-only /api/system/health endpoint.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "geo-seo",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
