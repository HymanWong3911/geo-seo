import { describe, expect, it, vi } from "vitest";

const { constructorCalls } = vi.hoisted(() => ({
  constructorCalls: [] as Array<[string, Record<string, unknown> | undefined]>,
}));

vi.mock("ioredis", () => ({
  default: class {
    constructor(url: string, options?: Record<string, unknown>) {
      constructorCalls.push([url, options]);
    }
  },
}));

import { connection, redis } from "./queue";

describe("Redis connection initialization", () => {
  it("keeps both Redis clients lazy so module imports do not connect during build", () => {
    expect(connection).toBeTruthy();
    expect(redis).toBeTruthy();
    expect(constructorCalls).toHaveLength(2);
    expect(constructorCalls[0][1]).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    expect(constructorCalls[1][1]).toMatchObject({ lazyConnect: true });
  });
});
