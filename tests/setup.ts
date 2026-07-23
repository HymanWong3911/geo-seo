// Vitest 全局设置。
// 2026-07-23: 先尝试加载 .env（vitest 不会自动 dotenv），找不到再走 fallback。
// 没有 .env 时 fallback 到 localhost stub,自己跑全链路（test:e2e）时 .env 必须存在。
try {
  // Node 20.6+ 原生 .env loader
  process.loadEnvFile?.(".env");
} catch {
  // .env 不存在时忽略,保留下面的 fallback
}

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/geo_seo_test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.AUTH_SECRET ??= "test-secret-32-bytes-long-1234567890";
process.env.APP_BASE_URL ??= "http://localhost:3010";
