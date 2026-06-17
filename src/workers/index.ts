// 启动所有 worker 进程。
// 用法：pnpm worker
// 进程常驻（BullMQ Worker 自带事件循环 + 我们用 setInterval 保持心跳）。
import { pageAuditWorker } from "./pageAuditWorker";
import { geoRunWorker } from "./geoRunWorker";
import { contentAnalysisWorker } from "./contentAnalysisWorker";
import { reportWorker } from "./reportWorker";
import { schedulerWorker } from "./schedulerWorker";
import { retentionWorker } from "./retentionWorker";
import { cmsPublisherWorker, publishDraft } from "./cmsPublisherWorker";
import { distributionWorker } from "./distributionWorker";
import { setupScheduler } from "@/lib/queue/scheduler";
import { prisma } from "@/lib/db";
import { monitorBrand } from "@/lib/brand/monitor";

const workers = {
  pageAudit: pageAuditWorker,
  geoRun: geoRunWorker,
  contentAnalysis: contentAnalysisWorker,
  report: reportWorker,
  scheduler: schedulerWorker,
  retention: retentionWorker,
  cmsPublish: cmsPublisherWorker,
  distribution: distributionWorker,
};

console.log(
  `[workers] ${new Date().toISOString()} starting:`,
  Object.fromEntries(Object.entries(workers).map(([k, w]) => [k, !!w])),
);

// 监听 worker 事件
for (const [name, w] of Object.entries(workers)) {
  w.on("completed", (job) => {
    console.log(`[workers] ${name} completed job ${job?.id}`);
  });
  w.on("failed", (job, err) => {
    console.error(`[workers] ${name} failed job ${job?.id}:`, err?.message ?? err);
  });
  w.on("error", (err) => {
    console.error(`[workers] ${name} worker error:`, err?.message ?? err);
  });
}

// 品牌监控：每 6 小时扫一次（生产用 cron，这里简化）
let brandMonitorRunning = false;
async function runBrandMonitorTick() {
  if (brandMonitorRunning) return;
  brandMonitorRunning = true;
  try {
    const projects = await prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, primaryBrand: true },
    });
    for (const p of projects) {
      try {
        const brands = await prisma.brand.findMany({
          where: { projectId: p.id },
          select: { name: true, aliases: true },
        });
        const competitors = await prisma.competitor.findMany({
          where: { projectId: p.id },
          select: { name: true },
        });
        const result = await monitorBrand({
          projectId: p.id,
          brands: brands.flatMap((b) => [b.name, ...b.aliases]),
          competitors: competitors.map((c) => c.name),
          maxResults: 5,
        });
        if (result.length > 0) {
          console.log(`[brand-monitor] ${p.name}: ${result.length} mentions`);
        }
      } catch (err) {
        console.error(`[brand-monitor] ${p.name} failed:`, err);
      }
    }
  } finally {
    brandMonitorRunning = false;
  }
}

const BRAND_MONITOR_INTERVAL_MS = 6 * 60 * 60 * 1000;
const brandMonitorTimer = setInterval(() => {
  void runBrandMonitorTick();
}, BRAND_MONITOR_INTERVAL_MS);

// 心跳：每 60s 打一次，验证 worker 活着
setInterval(() => {
  const counts = Object.fromEntries(
    Object.entries(workers).map(([k, w]) => [k, "running"]),
  );
  console.log(`[workers] ${new Date().toISOString()} heartbeat:`, counts);
}, 60_000);

// 注册 cron-style 调度（仅一次，成功后由 BullMQ repeat 接管）
setupScheduler().catch((err) => {
  console.error("[workers] setupScheduler failed:", err);
});

// 立刻跑一次品牌监控（方便验收）
setTimeout(() => {
  void runBrandMonitorTick();
}, 5_000);

// 优雅退出
async function shutdown(signal: string) {
  console.log(`[workers] ${signal} received, shutting down...`);
  clearInterval(brandMonitorTimer);
  await Promise.all(Object.values(workers).map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log("[workers] all workers running. Press Ctrl+C to stop.");
