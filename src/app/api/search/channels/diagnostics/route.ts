import { NextResponse } from "next/server";
import { getAllChannelsDiagnostics, type SearchProviderName } from "@/lib/search";

export async function GET() {
  try {
    const diagnostics = getAllChannelsDiagnostics();
    
    // 简化输出，移除 lastChecked（JSON 序列化问题）
    const result = Object.fromEntries(
      Object.entries(diagnostics).map(([name, diag]) => [
        name,
        {
          isConfigured: diag.isConfigured,
          isAvailable: diag.isAvailable,
          missingEnvVars: diag.missingEnvVars,
        },
      ])
    ) as Record<SearchProviderName, { isConfigured: boolean; isAvailable: boolean; missingEnvVars: string[] }>;

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to get channel diagnostics", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
