-- CMS credentials must be recoverable by the publisher, but never stored as plaintext.
ALTER TABLE "CmsIntegration"
  ADD COLUMN "apiKeyEncrypted" TEXT,
  ADD COLUMN "apiKeyIv" TEXT,
  ADD COLUMN "apiKeyTag" TEXT;
