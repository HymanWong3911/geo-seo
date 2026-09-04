import { Queue } from "bullmq";
import { connection } from "./connection";

export interface CmsPublishJob {
  draftId: string;
  integrationId: string;
  userId: string;
}

let queue: Queue<CmsPublishJob> | undefined;

function getCmsPublishQueue() {
  queue ??= new Queue<CmsPublishJob>("cms-publish", {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
      removeOnFail: { age: 60 * 24 * 3600 },
    },
  });
  return queue;
}

export function enqueueCmsPublish(job: CmsPublishJob) {
  return getCmsPublishQueue().add("publish", job, {
    jobId: `cms-${job.draftId.replace(/:/g, "_")}-${Date.now()}`,
  });
}
