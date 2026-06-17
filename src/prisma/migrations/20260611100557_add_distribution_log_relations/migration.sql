-- AddForeignKey
ALTER TABLE "DistributionLog" ADD CONSTRAINT "DistributionLog_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ContentDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
