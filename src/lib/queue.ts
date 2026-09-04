// BullMQ + ioredis 队列连接。
// 详细说明见 dev doc v1.2 13.1 节。
// 另导出 redis 作为通用 Redis 客户端（鉴权失败计数、缓存等用）。
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

// BullMQ 专用连接（maxRetriesPerRequest 必须为 null）
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// 通用 Redis 客户端（业务代码可直接使用）
export const redis = new IORedis(redisUrl, { lazyConnect: true });

// Queue 定义分别位于 src/lib/queue/*，避免仅导入连接时创建全部 Queue。
