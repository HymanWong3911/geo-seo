// GEO 运行队列。
import { Queue, type JobsOptions } from "bullmq";
import { connection } from "./connection";

export interface GeoRunJob {
  projectId: string;
  questionIds?: string[];   // 不传则跑项目下所有 active 问题
  userId?: string;
  triggerType: "MANUAL" | "SCHEDULED" | "RETRY";
}

let queue: Queue<GeoRunJob> | undefined;

function getGeoRunQueue() {
  queue ??= new Queue<GeoRunJob>("geo-run", {
    connection,
    defaultJobOptions: {
      attempts: 1,  // 失败不重试整 run（每个问题在 channel.ts 内部已重试）
      removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return queue;
}

export async function enqueueGeoRun(job: GeoRunJob, options?: Pick<JobsOptions, "delay" | "jobId">) {
  return getGeoRunQueue().add("run", job, options);
}
