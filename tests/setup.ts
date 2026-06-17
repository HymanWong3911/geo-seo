// Vitest 全局设置。
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/geo_seo_test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.AUTH_SECRET ??= "test-secret-32-bytes-long-1234567890";
process.env.APP_BASE_URL ??= "http://localhost:3000";
