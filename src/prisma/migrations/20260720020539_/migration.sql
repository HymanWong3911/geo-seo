/*
  Warnings:

  - A unique constraint covering the columns `[projectId,sourceUrl]` on the table `BrandMention` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DistributionPlatform" ADD VALUE 'BAIJIAHAO';
ALTER TYPE "DistributionPlatform" ADD VALUE 'DOUYIN';
ALTER TYPE "DistributionPlatform" ADD VALUE 'XIAOHONGSHU';
ALTER TYPE "DistributionPlatform" ADD VALUE 'COZE';
ALTER TYPE "DistributionPlatform" ADD VALUE 'BAIDU_WENXIN';
ALTER TYPE "DistributionPlatform" ADD VALUE 'TENCENT_YUANBAO';
ALTER TYPE "DistributionPlatform" ADD VALUE 'DINGTALK';
ALTER TYPE "DistributionPlatform" ADD VALUE 'BAIDU_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE 'SOGOU_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE 'SO360_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE 'SHENMA_SEARCH';
ALTER TYPE "DistributionPlatform" ADD VALUE 'CITATION_SITE';
ALTER TYPE "DistributionPlatform" ADD VALUE 'INDEX_SITE';

-- AlterTable
ALTER TABLE "DistributionTarget" ADD COLUMN     "autoPublishOn" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "publishMode" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "BrandMention_projectId_sourceUrl_key" ON "BrandMention"("projectId", "sourceUrl");
