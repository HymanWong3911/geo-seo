import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { connection } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CheckResult {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

async function time<T>(fn: () => Promise<T>): Promise<{ result?: T; error?: string; latencyMs: number }> {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { result, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - t0 };
  }
}

export async function GET() {
  const db = await time(() => prisma.$queryRaw`SELECT 1 AS ok`);
  const counts = await time(() =>
    Promise.all([
      prisma.project.count(),
      prisma.geoRun.count(),
      prisma.geoRunResult.count(),
      prisma.brandMention.count(),
      prisma.llmCall.count(),
      prisma.contentDraft.count(),
    ]),
  );
  const redis = await time(async () => {
    const pong = await connection.ping();
    if (pong !== "PONG") throw new Error(`unexpected ping: ${pong}`);
    return pong;
  });

  const lastRun = await time(() =>
    prisma.geoRun.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, status: true, createdAt: true, finishedAt: true } }),
  );

  const buildChecks = (r: { result?: unknown; error?: string; latencyMs: number }): CheckResult => ({
    ok: !r.error,
    latencyMs: r.latencyMs,
    detail: r.error,
  });

  const dbCheck = buildChecks(db);
  const redisCheck = buildChecks(redis);
  const countsCheck = buildChecks(counts);
  const lastRunCheck = buildChecks(lastRun);

  const allOk = dbCheck.ok && redisCheck.ok && countsCheck.ok;
  const httpStatus = allOk ? 200 : 503;

  const arr = (counts.result as number[] | undefined) ?? [0, 0, 0, 0, 0, 0];
  const [projectCount, geoRunCount, geoRunResultCount, brandMentionCount, llmCallCount, contentDraftCount] = arr;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: "geo-seo",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
        counts: countsCheck,
        lastRun: lastRunCheck,
      },
      data: {
        projectCount,
        geoRunCount,
        geoRunResultCount,
        brandMentionCount,
        llmCallCount,
        contentDraftCount,
        lastGeoRun: lastRun.result ?? null,
      },
    },
    { status: httpStatus },
  );
}
