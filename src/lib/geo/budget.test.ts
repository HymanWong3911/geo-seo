import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAggregate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    llmCall: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
  },
}));

import { checkMonthlyBudget } from "./budget";

describe("checkMonthlyBudget", () => {
  beforeEach(() => {
    mockAggregate.mockReset();
    process.env.GEO_BUDGET_MONTHLY_CENTS = "10000";
    process.env.GEO_BUDGET_ALERT_THRESHOLD = "0.8";
  });

  it("returns under limit when used < 80%", async () => {
    mockAggregate.mockResolvedValue({ _sum: { costCents: 1000 } });
    const r = await checkMonthlyBudget();
    expect(r.used).toBe(1000);
    expect(r.limit).toBe(10000);
    expect(r.exceeded).toBe(false);
    expect(r.shouldAlert).toBe(false);
    expect(r.percentUsed).toBeCloseTo(0.1);
  });

  it("alerts when used >= 80%", async () => {
    mockAggregate.mockResolvedValue({ _sum: { costCents: 8000 } });
    const r = await checkMonthlyBudget();
    expect(r.shouldAlert).toBe(true);
    expect(r.exceeded).toBe(false);
  });

  it("marks exceeded when used >= 100%", async () => {
    mockAggregate.mockResolvedValue({ _sum: { costCents: 12000 } });
    const r = await checkMonthlyBudget();
    expect(r.exceeded).toBe(true);
    expect(r.shouldAlert).toBe(false); // already over, no need to alert
    expect(r.remaining).toBe(0);
  });

  it("handles null used sum", async () => {
    mockAggregate.mockResolvedValue({ _sum: { costCents: null } });
    const r = await checkMonthlyBudget();
    expect(r.used).toBe(0);
    expect(r.percentUsed).toBe(0);
  });
});
