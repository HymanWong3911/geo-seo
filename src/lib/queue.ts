// BullMQ + ioredis 队列连接。
// 详细说明见 dev doc v1.2 13.1 节。
// 另导出 redis 作为通用 Redis 客户端（鉴权失败计数、缓存等用）。
import IORedis from "ioredis";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ 专用连接（maxRetriesPerRequest 必须为 null）
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// 通用 Redis 客户端（业务代码可直接使用）
export const redis = new IORedis(redisUrl);

// 队列定义
export const pageAuditQueue = new Queue("page-audit", { connection });
export const geoRunQueue = new Queue("geo-run", { connection });
export const contentAnalysisQueue = new Queue("content-analysis", { connection });
export const reportQueue = new Queue("report-generation", { connection });
export const alertQueue = new Queue("alert-sender", { connection });
// distribution 队列在 src/lib/queue/distribution.ts 独立定义，避免循环依赖
// 用法：import { distributionQueue, enqueueDistribution, enqueueAutoDistribution } from "@/lib/queue/distribution";
