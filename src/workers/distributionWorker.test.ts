import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { DistributionJob } from "@/lib/queue/distribution";

const mockDistribute = vi.fn();

vi.mock("@/lib/distribution", () => ({
  distributeToTarget: (...args: unknown[]) => mockDistribute(...args),
  getDistributionHistory: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { distributionTarget: { findUnique: vi.fn() } },
}));

import { processDistributionJob } from "./distributionWorker";

const job = {
  data: { draftId: "d1", targetId: "t1", triggerType: "MANUAL" },
  attemptsMade: 1,
} as Job<DistributionJob>;

describe("distribution worker retry contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns successful adapter results", async () => {
    mockDistribute.mockResolvedValue({ success: true, externalId: "x1" });

    await expect(processDistributionJob(job)).resolves.toMatchObject({ success: true });
    expect(mockDistribute).toHaveBeenCalledWith({ draftId: "d1", targetId: "t1", attempt: 2 });
  });

  it("throws failed results so BullMQ performs the configured retry", async () => {
    mockDistribute.mockResolvedValue({ success: false, error: "upstream timeout" });

    await expect(processDistributionJob(job)).rejects.toThrow("upstream timeout");
  });
});
