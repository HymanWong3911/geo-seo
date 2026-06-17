-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SearchIntent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL', 'LOCAL', 'COMPARISON');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('SEO_AUDIT', 'GEO_RUN', 'CONTENT_ANALYSIS', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DOING', 'REVIEW', 'DONE', 'IGNORED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL_FAILURE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_LOGIN_FAILED', 'USER_PASSWORD_CHANGED', 'USER_PASSWORD_RESET', 'USER_CREATED', 'USER_UPDATED', 'USER_DISABLED', 'USER_ENABLED', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_ARCHIVE', 'PROJECT_MEMBER_ADD', 'PROJECT_MEMBER_UPDATE', 'PROJECT_MEMBER_REMOVE', 'KEYWORD_CREATE', 'KEYWORD_UPDATE', 'KEYWORD_DELETE', 'KEYWORD_IMPORTED', 'GEO_QUESTION_CREATE', 'GEO_QUESTION_UPDATE', 'GEO_QUESTION_DELETE', 'GEO_RUN_TRIGGER', 'GEO_RUN_AUTO_SCHEDULED', 'PAGE_AUDIT_TRIGGER', 'CONTENT_ANALYSIS_TRIGGER', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_DELETE', 'REPORT_EXPORT', 'DATA_DELETE', 'SETTINGS_UPDATE', 'ALERT_CHANNEL_UPDATE', 'BRAND_CREATE', 'BRAND_UPDATE', 'BRAND_DELETE', 'COMPETITOR_CREATE', 'COMPETITOR_UPDATE', 'COMPETITOR_DELETE');

-- CreateEnum
CREATE TYPE "AlertChannelType" AS ENUM ('FEISHU', 'WECOM', 'EMAIL');

-- CreateEnum
CREATE TYPE "AlertEventType" AS ENUM ('GEO_RUN_FAILED', 'DAILY_GEO_SUMMARY', 'ANOMALY_DETECTED');

-- CreateEnum
CREATE TYPE "ContentDraftStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('AI_GENERATED', 'AI_REWRITTEN', 'MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "DistributionPlatform" AS ENUM ('ZHIHU', 'WECHAT_MP', 'FEISHU_DOC', 'NOTION', 'CUSTOM_WEBHOOK');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'AUDIT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMENT_MENTION', 'COMMENT_REPLY', 'TASK_ASSIGNED', 'TASK_DUE_SOON', 'GEO_ANOMALY', 'DRAFT_APPROVED', 'DRAFT_REJECTED', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastPasswordChangeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "primaryBrand" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "region" TEXT NOT NULL DEFAULT 'CN',
    "sitemapUrl" TEXT,
    "robotsUrl" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "geoDailyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "geoChannels" TEXT[] DEFAULT ARRAY['perplexity', 'kimi', 'doubao']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "products" TEXT[],
    "description" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "aliases" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "h1" TEXT,
    "wordCount" INTEGER,
    "lastCrawledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAudit" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "statusCode" INTEGER,
    "indexable" BOOLEAN,
    "findings" JSONB NOT NULL,
    "rawSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "region" TEXT NOT NULL DEFAULT 'CN',
    "intent" "SearchIntent" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoQuestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "region" TEXT NOT NULL DEFAULT 'CN',
    "intent" "SearchIntent" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "keywordIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "questionIds" TEXT[],
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRunResult" (
    "id" TEXT NOT NULL,
    "geoRunId" TEXT NOT NULL,
    "geoQuestionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "providerSource" TEXT NOT NULL,
    "providerAttempts" INTEGER NOT NULL DEFAULT 1,
    "citedUrls" TEXT[],
    "mentionedBrands" TEXT[],
    "mentionedCompetitors" TEXT[],
    "primaryBrandMentioned" BOOLEAN NOT NULL DEFAULT false,
    "primaryBrandRecommended" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "position" INTEGER,
    "links" TEXT[],
    "analysis" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "TaskSource" NOT NULL,
    "sourceId" TEXT,
    "url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "assignee" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "geoRunId" TEXT,
    "jobType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertChannelType" NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "events" "AlertEventType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "eventType" "AlertEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentFormat" TEXT NOT NULL DEFAULT 'html',
    "excerpt" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "slug" TEXT,
    "sourceType" "ContentSource" NOT NULL,
    "sourcePrompt" TEXT,
    "targetUrl" TEXT,
    "targetKeywords" TEXT[],
    "status" "ContentDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentFormat" TEXT NOT NULL DEFAULT 'html',
    "excerpt" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "changeNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsIntegration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'self-hosted',
    "baseUrl" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "cmsIntegrationId" TEXT NOT NULL,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "rollbackReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionTarget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "DistributionPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionLog" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "draftId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DistributionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordExpansion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "seedKeywordId" TEXT,
    "seedKeywordText" TEXT NOT NULL,
    "expandedText" TEXT NOT NULL,
    "searchVolume" INTEGER,
    "difficulty" INTEGER,
    "intent" "SearchIntent",
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeywordExpansion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentionType" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "sentiment" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relevanceScore" INTEGER,

    CONSTRAINT "BrandMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT[],
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "auditId" TEXT,
    "content" TEXT NOT NULL,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "link" TEXT,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channelInApp" BOOLEAN NOT NULL DEFAULT true,
    "channelEmail" BOOLEAN NOT NULL DEFAULT false,
    "channelFeishu" BOOLEAN NOT NULL DEFAULT false,
    "channelWeCom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "UserProject_projectId_idx" ON "UserProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProject_userId_projectId_key" ON "UserProject"("userId", "projectId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Page_projectId_idx" ON "Page"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_projectId_url_key" ON "Page"("projectId", "url");

-- CreateIndex
CREATE INDEX "PageAudit_pageId_createdAt_idx" ON "PageAudit"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "Keyword_projectId_idx" ON "Keyword"("projectId");

-- CreateIndex
CREATE INDEX "GeoQuestion_projectId_active_idx" ON "GeoQuestion"("projectId", "active");

-- CreateIndex
CREATE INDEX "GeoRun_projectId_createdAt_idx" ON "GeoRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GeoRun_status_createdAt_idx" ON "GeoRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GeoRunResult_geoRunId_idx" ON "GeoRunResult"("geoRunId");

-- CreateIndex
CREATE INDEX "GeoRunResult_geoQuestionId_createdAt_idx" ON "GeoRunResult"("geoQuestionId", "createdAt");

-- CreateIndex
CREATE INDEX "GeoRunResult_providerSource_createdAt_idx" ON "GeoRunResult"("providerSource", "createdAt");

-- CreateIndex
CREATE INDEX "OptimizationTask_projectId_status_idx" ON "OptimizationTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_projectId_createdAt_idx" ON "LlmCall"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_geoRunId_idx" ON "LlmCall"("geoRunId");

-- CreateIndex
CREATE INDEX "LlmCall_createdAt_idx" ON "LlmCall"("createdAt");

-- CreateIndex
CREATE INDEX "LlmCall_jobType_createdAt_idx" ON "LlmCall"("jobType", "createdAt");

-- CreateIndex
CREATE INDEX "AlertChannel_active_idx" ON "AlertChannel"("active");

-- CreateIndex
CREATE INDEX "AlertEvent_channelId_createdAt_idx" ON "AlertEvent"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_status_createdAt_idx" ON "AlertEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentDraft_projectId_status_idx" ON "ContentDraft"("projectId", "status");

-- CreateIndex
CREATE INDEX "ContentDraft_authorId_createdAt_idx" ON "ContentDraft"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentDraft_status_updatedAt_idx" ON "ContentDraft"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_draftId_version_key" ON "ContentRevision"("draftId", "version");

-- CreateIndex
CREATE INDEX "ContentReview_draftId_createdAt_idx" ON "ContentReview"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "CmsIntegration_projectId_active_idx" ON "CmsIntegration"("projectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PublishLog_draftId_key" ON "PublishLog"("draftId");

-- CreateIndex
CREATE INDEX "PublishLog_status_createdAt_idx" ON "PublishLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DistributionTarget_projectId_active_idx" ON "DistributionTarget"("projectId", "active");

-- CreateIndex
CREATE INDEX "DistributionLog_targetId_createdAt_idx" ON "DistributionLog"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "DistributionLog_status_createdAt_idx" ON "DistributionLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KeywordExpansion_projectId_status_idx" ON "KeywordExpansion"("projectId", "status");

-- CreateIndex
CREATE INDEX "BrandMention_projectId_discoveredAt_idx" ON "BrandMention"("projectId", "discoveredAt");

-- CreateIndex
CREATE INDEX "BrandMention_source_discoveredAt_idx" ON "BrandMention"("source", "discoveredAt");

-- CreateIndex
CREATE INDEX "BrandMention_brandName_publishedAt_idx" ON "BrandMention"("brandName", "publishedAt");

-- CreateIndex
CREATE INDEX "Comment_targetType_targetId_createdAt_idx" ON "Comment"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_createdAt_idx" ON "Comment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_projectId_type_createdAt_idx" ON "Report"("projectId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "NotificationPreference"("userId", "type");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAudit" ADD CONSTRAINT "PageAudit_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoQuestion" ADD CONSTRAINT "GeoQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRun" ADD CONSTRAINT "GeoRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRunResult" ADD CONSTRAINT "GeoRunResult_geoRunId_fkey" FOREIGN KEY ("geoRunId") REFERENCES "GeoRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRunResult" ADD CONSTRAINT "GeoRunResult_geoQuestionId_fkey" FOREIGN KEY ("geoQuestionId") REFERENCES "GeoQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptimizationTask" ADD CONSTRAINT "OptimizationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsIntegration" ADD CONSTRAINT "CmsIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishLog" ADD CONSTRAINT "PublishLog_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishLog" ADD CONSTRAINT "PublishLog_cmsIntegrationId_fkey" FOREIGN KEY ("cmsIntegrationId") REFERENCES "CmsIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionTarget" ADD CONSTRAINT "DistributionTarget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionLog" ADD CONSTRAINT "DistributionLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "DistributionTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordExpansion" ADD CONSTRAINT "KeywordExpansion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMention" ADD CONSTRAINT "BrandMention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
