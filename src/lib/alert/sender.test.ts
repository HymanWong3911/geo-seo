// 告警 sender 单元测试（mock fetch + redis + prisma）。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSet = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/queue", () => ({
  redis: { set: (...args: unknown[]) => mockSet(...args) },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    alertChannel: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    alertEvent: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));
vi.mock("@/lib/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(true),
}));

import { sendAlert } from "./sender";

describe("sendAlert", () => {
  beforeEach(() => {
    mockSet.mockReset();
    mockFindMany.mockReset();
    mockCreate.mockReset();
    // 默认：set 返回 OK（不重复）
    mockSet.mockResolvedValue("OK");
    mockCreate.mockResolvedValue({});
  });

  it("sends to all active channels subscribed to event", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "ch1",
        type: "FEISHU",
        config: { webhookUrl: "https://feishu/hook" },
        events: ["GEO_RUN_FAILED"],
        active: true,
      },
      {
        id: "ch2",
        type: "WECOM",
        config: { webhookUrl: "https://wecom/hook" },
        events: ["GEO_RUN_FAILED", "DAILY_GEO_SUMMARY"],
        active: true,
      },
    ]);

    await sendAlert({
      eventType: "GEO_RUN_FAILED",
      payload: { title: "测试", 项目: "测试项目" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("skips channels that already alerted within dedupe window", async () => {
    mockSet.mockResolvedValue(null);  // 模拟已存在
    mockFindMany.mockResolvedValue([
      {
        id: "ch1",
        type: "FEISHU",
        config: { webhookUrl: "https://feishu/hook" },
        events: ["GEO_RUN_FAILED"],
        active: true,
      },
    ]);

    await sendAlert({
      eventType: "GEO_RUN_FAILED",
      payload: { title: "测试" },
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("only sends to channels subscribed to the event type", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "ch1",
        type: "FEISHU",
        config: { webhookUrl: "https://feishu/hook" },
        events: ["DAILY_GEO_SUMMARY"],
        active: true,
      },
    ]);

    await sendAlert({
      eventType: "GEO_RUN_FAILED",
      payload: { title: "测试" },
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          events: { has: "GEO_RUN_FAILED" },
        }),
      }),
    );
  });
});
