// /api/system/health 单元测试
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCount = vi.fn();
const mockFindFirst = vi.fn();
const mockGroupBy = vi.fn();
const mockAggregate = vi.fn();
const mockQueueOp = vi.fn();
const mockRequireSession = vi.fn();
const mockExecSync = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { count: (...a: unknown[]) => mockCount(...a) },
    geoRun: {
      count: (...a: unknown[]) => mockCount(...a),
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
    geoRunResult: { count: (...a: unknown[]) => mockCount(...a) },
    brandMention: { count: (...a: unknown[]) => mockCount(...a) },
    llmCall: {
      count: (...a: unknown[]) => mockCount(...a),
      aggregate: (...a: unknown[]) => mockAggregate(...a),
    },
    contentDraft: { count: (...a: unknown[]) => mockCount(...a) },
  },
}));

vi.mock("@/lib/api/auth", () => ({
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
}));

vi.mock("@/lib/queue", () => ({
  connection: {},
}));

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(public name: string) {}
    getWaitingCount = () => mockQueueOp("waiting");
    getActiveCount = () => mockQueueOp("active");
    getCompletedCount = () => mockQueueOp("completed");
    getFailedCount = () => mockQueueOp("failed");
    getDelayedCount = () => mockQueueOp("delayed");
    close = () => Promise.resolve();
  },
}));

vi.mock("node:child_process", () => ({
  execSync: (...a: unknown[]) => mockExecSync(...a),
}));

vi.mock("@/lib/api/response", () => ({
  success: (data: unknown) => ({ status: 200, body: { data, error: null } }),
  handleError: () => ({ status: 500 }),
}));

import { GET } from "./route";

const ctx = () => ({});

describe("GET /api/system/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "u1" } });
    mockQueueOp.mockImplementation((k: string) => (k === "failed" ? 1 : k === "completed" ? 10 : 0));
    mockExecSync.mockReturnValue("01:23:45\n");
  });

  it("returns counts, queues, lastRun, llm24h", async () => {
    // mock 顺序对应 route 中的 prisma 调用顺序:
    // 1) project.count, 2) geoRun.count 24h, 3) geoRunResult.count, 4) brandMention.count,
    // 5) llmCall.count 24h, 6) contentDraft.count, 7) geoRun.findFirst, 8) geoRun.count failed 24h
    mockCount.mockResolvedValueOnce(5);  // project
    mockCount.mockResolvedValueOnce(20); // geoRun 24h
    mockCount.mockResolvedValueOnce(100); // geoRunResult
    mockCount.mockResolvedValueOnce(800); // brandMention
    mockCount.mockResolvedValueOnce(600); // llmCall 24h
    mockCount.mockResolvedValueOnce(8);  // contentDraft
    mockFindFirst.mockResolvedValueOnce({ id: "g1", status: "SUCCESS", createdAt: new Date(), finishedAt: new Date() });
    mockCount.mockResolvedValueOnce(20); // failed 24h
    mockAggregate.mockResolvedValueOnce({ _count: { id: 600 }, _sum: { totalTokens: 80000, costCents: 20 } });
    mockExecSync.mockReturnValueOnce("1137 npm exec tsx\n1176 node tsx\n1182 /opt/x\n");

    const res = await GET(new Request("http://x/api/system/health") as never, ctx() as never);
    const data = (res as { body: { data: { counts: { projectCount: number }; workerProcesses: number; queues: Record<string, { failed: number }> } } }).body.data;
    expect(data.counts.projectCount).toBe(5);
    expect(data.workerProcesses).toBe(3);
    expect(data.queues["geo-run"].failed).toBe(1);
    expect(data.queues["geo-run"].completed).toBe(10);
  });

  it("returns 500 when requireSession throws", async () => {
    mockRequireSession.mockRejectedValue(new Error("unauthorized"));
    const res = await GET(new Request("http://x/api/system/health") as never, ctx() as never);
    expect((res as { status: number }).status).toBe(500);
  });
});
