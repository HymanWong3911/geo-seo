-- Reconcile fields and enum values that existed in the Prisma schema but were
-- never captured by a migration. IF NOT EXISTS also makes this safe for
-- environments where the schema had previously been applied with `db push`.
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'BAIJIAHAO';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'DOUYIN';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'XIAOHONGSHU';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'COZE';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'BAIDU_WENXIN';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'TENCENT_YUANBAO';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'DINGTALK';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'BAIDU_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'SOGOU_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'SO360_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'SHENMA_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'CITATION_SITE';
ALTER TYPE "DistributionPlatform" ADD VALUE IF NOT EXISTS 'INDEX_SITE';

ALTER TABLE "DistributionTarget"
  ADD COLUMN IF NOT EXISTS "autoPublishOn" TEXT NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS "publishMode" TEXT NOT NULL DEFAULT 'MANUAL';

CREATE UNIQUE INDEX IF NOT EXISTS "BrandMention_projectId_sourceUrl_key"
  ON "BrandMention"("projectId", "sourceUrl");
