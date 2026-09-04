import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProjectFindMany = vi.fn();
const mockEnqueueGeoRun = vi.fn();
const mockBudget = vi.fn();
const mockRetention = vi.fn();

vi.mock("bullmq", () => ({
  Worker: class {
    on() { return this; }
    close() { return Promise.resolve(); }
  },
}));
vi.mock("@/lib/queue", () => ({ connection: {} }));
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findMany: (...args: unknown[]) => mockProjectFindMany(...args), count: vi.fn() },
    geoRun: { count: vi.fn(), findMany: vi.fn() },
    llmCall: { aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/queue/geo", () => ({
  enqueueGeoRun: (...args: unknown[]) => mockEnqueueGeoRun(...args),
}));
vi.mock("@/lib/geo/budget", () => ({
  checkMonthlyBudget: (...args: unknown[]) => mockBudget(...args),
}));
vi.mock("@/lib/alert/sender", () => ({ sendAlert: vi.fn(), sendDailySummary: vi.fn() }));
vi.mock("./retentionWorker", () => ({
  runRetentionCleanup: (...args: unknown[]) => mockRetention(...args),
}));

import { processSchedulerJob, runDailyGeoMonitor } from "./schedulerWorker";

describe("scheduler worker dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBudget.mockResolvedValue({ exceeded: false, limit: 0, used: 0 });
    mockEnqueueGeoRun.mockResolvedValue({ id: "job" });
  });

  it("stagger-enqueues daily GEO jobs by one minute per project", async () => {
    mockProjectFindMany.mockResolvedValue([
      { id: "p1", name: "One" },
      { id: "p2", name: "Two" },
    ]);

    await runDailyGeoMonitor();

    expect(mockEnqueueGeoRun).toHaveBeenNthCalledWith(
      1,
      { projectId: "p1", triggerType: "SCHEDULED" },
      { delay: 60_000 },
    );
    expect(mockEnqueueGeoRun).toHaveBeenNthCalledWith(
      2,
      { projectId: "p2", triggerType: "SCHEDULED" },
      { delay: 120_000 },
    );
  });

  it("dispatches retention through the single scheduler consumer", async () => {
    mockRetention.mockResolvedValue(undefined);

    await processSchedulerJob({ type: "retention-cleanup" });

    expect(mockRetention).toHaveBeenCalledTimes(1);
  });

  it("fails unknown scheduler jobs instead of silently completing them", async () => {
    await expect(processSchedulerJob({ type: "unknown" } as never)).rejects.toThrow(
      "Unknown scheduler job type",
    );
  });
});
