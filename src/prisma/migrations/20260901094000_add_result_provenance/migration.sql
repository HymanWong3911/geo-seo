ALTER TABLE "GeoRunResult"
  ADD COLUMN "provenanceKind" TEXT NOT NULL DEFAULT 'real-search',
  ADD COLUMN "isSynthetic" BOOLEAN NOT NULL DEFAULT false;

UPDATE "GeoRunResult"
SET "provenanceKind" = 'llm-simulation',
    "isSynthetic" = true
WHERE "providerSource" = 'llm_simulation';

ALTER TABLE "ContentDraft"
  ADD COLUMN "provenance" JSONB;

ALTER TABLE "ContentRevision"
  ADD COLUMN "provenance" JSONB;

CREATE INDEX "GeoRunResult_isSynthetic_createdAt_idx"
  ON "GeoRunResult"("isSynthetic", "createdAt");
