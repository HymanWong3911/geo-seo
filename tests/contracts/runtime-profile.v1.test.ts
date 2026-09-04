import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
  CAPABILITY_NAMES_V1,
  parseWorkerRuntimeProfileV1,
  resolveRuntimeProfileV1,
  type WorkerRuntimeProfileInputV1,
} from "@/workers/harness/runtime-profile";

function offlineProfile(): WorkerRuntimeProfileInputV1 {
  return {
    profileId: "offline-test-v1",
    contractVersion: "geo-seo.worker-runtime-profile.v1",
    enabledWorkers: ["geo-run"],
    allowedTriggers: ["manual", "operator-replay", "retry"],
    capabilityPolicies: {
      "search.query": "synthetic", "llm.complete": "synthetic", "product-state.read": "isolated-state",
      "product-state.write": "isolated-state", "web.crawl": "deny", "notification.send": "deny",
      "schedule.register": "deny", "retention.execute": "deny", "artifact.write": "deny",
      "cms.publish": "deny", "content.distribute": "deny",
    },
    providerEgress: "deny",
    providerAllowlist: [],
    infrastructureConnections: [
      { kind: "postgres", bindingId: "pg-task-1", addressHost: "postgres", addressPort: 5432, networkMode: "docker-internal", resourceReceiptRef: "receipt:pg" },
      { kind: "redis", bindingId: "redis-task-1", addressHost: "redis", addressPort: 6379, networkMode: "docker-internal", resourceReceiptRef: "receipt:redis" },
    ],
    queueBindings: [{ logicalName: "geo-run", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" }],
    providerBindings: [
      { runtimeComponentId: "adapter/search.query/builtin:llm-simulation", capabilityName: "search.query", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:llm-simulation" },
      { runtimeComponentId: "adapter/llm.complete/builtin:mock", capabilityName: "llm.complete", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:mock" },
    ],
    externalWrite: "deny",
    humanApprovalForExternalWrite: true,
    evidence: "contract-only",
  };
}
function receipt(profile = offlineProfile()) {
  return {
    scopeId: "task-1",
    infrastructureBindings: profile.infrastructureConnections.map((binding) => ({ ...binding })),
    queueBindings: profile.queueBindings.map((binding) => ({ ...binding })),
  };
}

describe("WorkerRuntimeProfileV1", () => {
  it("parses the controlled offline profile and its complete capability matrix", () => {
    const parsed = parseWorkerRuntimeProfileV1(offlineProfile());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(Object.keys(parsed.profile.capabilityPolicies).sort()).toEqual([...CAPABILITY_NAMES_V1].sort());
  });

  it("normalizes a deep immutable copy rather than retaining mutable profile input", () => {
    const input = offlineProfile();
    const raw = { ...input, infrastructureConnections: input.infrastructureConnections.map((binding) => ({ ...binding })) };
    const parsed = parseWorkerRuntimeProfileV1(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    raw.infrastructureConnections[0].addressHost = "mutated";
    expect(parsed.profile.infrastructureConnections[0].addressHost).toBe("postgres");
    expect(Object.isFrozen(parsed.profile.infrastructureConnections)).toBe(true);
    expect(Object.isFrozen(parsed.profile.infrastructureConnections[0])).toBe(true);
    expect(Object.isFrozen(parsed.profile.queueBindings[0])).toBe(true);
    expect(Object.isFrozen(parsed.profile.providerBindings[0])).toBe(true);
  });

  it("fails closed with exit 78 for missing, unknown, malformed, and incompatible profiles", () => {
    expect(parseWorkerRuntimeProfileV1(undefined)).toMatchObject({ ok: false, exitCode: 78, reasonCode: "PROFILE_MISSING" });
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), profileId: "anything-goes" })).toMatchObject({ ok: false, exitCode: 78, reasonCode: "PROFILE_UNKNOWN" });
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), contractVersion: "v2" })).toMatchObject({ ok: false, exitCode: 78, reasonCode: "PROFILE_VERSION_INVALID" });
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), extra: true })).toMatchObject({ ok: false, exitCode: 78, reasonCode: "PROFILE_INVALID" });
  });

  it("does not allow any profile or override to weaken the SafetyFloor", () => {
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), externalWrite: "allow" })).toMatchObject({ ok: false, reasonCode: "SAFETY_FLOOR_VIOLATION" });
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), humanApprovalForExternalWrite: false })).toMatchObject({ ok: false, reasonCode: "SAFETY_FLOOR_VIOLATION" });
    expect(resolveRuntimeProfileV1({
      selector: "offline-test-v1", immutableProfile: offlineProfile(),
      taskResourceReceipt: receipt(),
      perRun: { externalWrite: "allow" },
    })).toMatchObject({ ok: false, exitCode: 78, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
  });

  it("enforces controlled selection and receipt-only precedence", () => {
    const taskReceipt = receipt();
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, perRun: { runId: "run-1", attempt: 1, trigger: "manual", input: { kind: "product-input", ref: "input:1" }, deadline: "2026-02-28T00:00:00Z" } })).toMatchObject({ ok: true });
    expect(resolveRuntimeProfileV1({ selector: "production-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "unknown-profile", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt })).toMatchObject({ ok: false, reasonCode: "PROFILE_UNKNOWN" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: { ...taskReceipt, infrastructureBindings: [{ ...taskReceipt.infrastructureBindings[0], addressPort: 9999 }, taskReceipt.infrastructureBindings[1]] } })).toMatchObject({ ok: false, reasonCode: "RESOURCE_RECEIPT_MISSING" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: ["builtin:mock"], credentialRefs: [] } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, perRun: { attempt: 0 } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, perRun: { trigger: "scheduled" } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, perRun: { input: { kind: "artifact", ref: "input:1" } } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "offline-test-v1", immutableProfile: offlineProfile(), taskResourceReceipt: taskReceipt, perRun: { deadline: "2026-02-30T00:00:00Z" } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
  });

  it("requires exactly the receipt-bound offline postgres and redis pair", () => {
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), infrastructureConnections: [...offlineProfile().infrastructureConnections, { kind: "redis", bindingId: "redis-extra", addressHost: "redis", addressPort: 6380, networkMode: "docker-internal", resourceReceiptRef: "receipt:extra" }] })).toMatchObject({ ok: false, reasonCode: "RESOURCE_RECEIPT_MISSING" });
    expect(parseWorkerRuntimeProfileV1({ ...offlineProfile(), infrastructureConnections: [{ ...offlineProfile().infrastructureConnections[0], networkMode: "loopback", addressHost: "localhost" }, offlineProfile().infrastructureConnections[1]] })).toMatchObject({ ok: false, reasonCode: "RESOURCE_RECEIPT_MISSING" });
  });

  it("uses an empty dedicated offline setup rather than the default environment-loading setup", () => {
    expect(readFileSync("tests/offline/setup.ts", "utf8").trim()).toBe("export {};");
    expect(readFileSync("vitest.offline.config.ts", "utf8")).not.toContain("tests/setup.ts");
    expect(readFileSync("vitest.offline.config.ts", "utf8")).toContain("envDir: false");
  });

  it("typechecks all contract sources even though the application tsconfig excludes tests", () => {
    const contractFiles = [
      "tests/contracts/runtime-profile.v1.test.ts",
      "tests/contracts/queue-binding.v1.test.ts",
      "tests/contracts/capability-port.v1.test.ts",
      "tests/contracts/capability-policy.v1.test.ts",
      "tests/contracts/policy-decision.v1.test.ts",
    ].map((file) => path.resolve(file));
    const loaded = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
    expect(loaded.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, process.cwd());
    const program = ts.createProgram({ rootNames: [...new Set([...parsed.fileNames, ...contractFiles])], options: { ...parsed.options, noEmit: true, incremental: false } });
    expect(program.getRootFileNames()).toEqual(expect.arrayContaining(contractFiles));
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
  }, 20_000);
});
