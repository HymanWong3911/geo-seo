import { describe, expect, it, vi } from "vitest";
import {
  authStateProbeTimeoutMs,
  readAuthStateProbe,
  type AuthStateProbeSnapshot,
} from "@/lib/auth/state-probe";

describe("node middleware authoritative auth-state feasibility boundary", () => {
  it("returns the authoritative state when the loader succeeds", async () => {
    const state: AuthStateProbeSnapshot = {
      id: "probe-user",
      active: true,
      mustChangePassword: true,
    };
    const load = vi.fn().mockResolvedValue(state);

    await expect(
      readAuthStateProbe({ userId: state.id, timeoutMs: 100, load }),
    ).resolves.toEqual({ status: "available", state });
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(state.id);
  });

  it("fails closed when the authoritative loader throws", async () => {
    const load = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(
      readAuthStateProbe({ userId: "probe-user", timeoutMs: 100, load }),
    ).resolves.toEqual({ status: "unavailable", reason: "error" });
  });

  it("fails closed within the configured timeout", async () => {
    vi.useFakeTimers();
    const load = vi.fn(
      () => new Promise<AuthStateProbeSnapshot | null>(() => undefined),
    );
    const pending = readAuthStateProbe({
      userId: "probe-user",
      timeoutMs: 50,
      load,
    });

    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toEqual({
      status: "unavailable",
      reason: "timeout",
    });
    vi.useRealTimers();
  });

  it("bounds invalid and extreme timeout configuration", () => {
    expect(authStateProbeTimeoutMs("invalid")).toBe(500);
    expect(authStateProbeTimeoutMs("1")).toBe(50);
    expect(authStateProbeTimeoutMs("999999")).toBe(5_000);
  });
});
