import { describe, expect, it } from "vitest";
import {
  CAPABILITY_NAMES_V1,
  createAdapterBoundaryBindingV1,
  effectiveCapabilityPolicyV1,
  isCredentialRefV1,
  isApprovalCheckpointRefV1,
  isPolicyFingerprintV1,
  isProviderRefV1,
  isResourceReceiptRefV1,
  parseWorkerRuntimeProfileV1,
  resolveRuntimeProfileV1,
  type BoundaryBindingV1,
  type CredentialRefV1,
  type ProviderRefV1,
  type WorkerRuntimeProfileV1,
  type WorkerRuntimeProfileInputV1,
} from "@/workers/harness/runtime-profile";
import { checkStaticManifestCapabilityV1, checkStaticManifestComponentCapabilityV1, STATIC_RUNTIME_COMPONENT_CAPABILITY_MANIFEST_V1, STATIC_WORKER_CAPABILITY_MANIFEST_V1 } from "@/workers/harness/static-manifest";

const policies = {
  "search.query": "synthetic", "llm.complete": "synthetic", "product-state.read": "isolated-state",
  "product-state.write": "isolated-state", "web.crawl": "deny", "notification.send": "deny",
  "schedule.register": "deny", "retention.execute": "deny", "artifact.write": "deny",
  "cms.publish": "deny", "content.distribute": "deny",
} as const;
const productionPolicies = {
  "search.query": "allowlisted", "llm.complete": "allowlisted", "product-state.read": "allowlisted",
  "product-state.write": "allowlisted", "web.crawl": "allowlisted", "notification.send": "deny",
  "schedule.register": "allowlisted", "retention.execute": "allowlisted", "artifact.write": "allowlisted",
  "cms.publish": "deny", "content.distribute": "deny",
} as const;
const profile: WorkerRuntimeProfileInputV1 = {
  profileId: "offline-test-v1", contractVersion: "geo-seo.worker-runtime-profile.v1", enabledWorkers: ["geo-run"], allowedTriggers: ["manual", "operator-replay", "retry"], capabilityPolicies: policies,
  providerEgress: "deny", providerAllowlist: [], infrastructureConnections: [
    { kind: "postgres", bindingId: "pg", addressHost: "postgres", addressPort: 5432, networkMode: "docker-internal", resourceReceiptRef: "receipt:pg" },
    { kind: "redis", bindingId: "redis", addressHost: "redis", addressPort: 6379, networkMode: "docker-internal", resourceReceiptRef: "receipt:redis" },
  ], queueBindings: [{ logicalName: "geo-run", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" }], providerBindings: [
    { runtimeComponentId: "adapter/search.query/builtin:llm-simulation", capabilityName: "search.query", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:llm-simulation" },
    { runtimeComponentId: "adapter/llm.complete/builtin:mock", capabilityName: "llm.complete", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:mock" },
  ], externalWrite: "deny", humanApprovalForExternalWrite: true, evidence: "contract-only",
};

// These compile-time regressions mirror the runtime parser's discriminated binding contract.
if (false) {
  // @ts-expect-error adapter variants always require their providerRef
  const adapterWithoutProvider: BoundaryBindingV1 = { runtimeComponentId: "adapter/search.query/builtin:mock", capabilityName: "search.query", profileId: "offline-test-v1", policyFingerprint: "policy:test" };
  // @ts-expect-error state-worker variants never permit a providerRef
  const stateWithProvider: BoundaryBindingV1 = { runtimeComponentId: "worker/geo-run", capabilityName: "product-state.read", profileId: "offline-test-v1", policyFingerprint: "policy:test", providerRef: "builtin:mock" };
  // @ts-expect-error an unmounted state worker cannot be supplied as a validated boundary
  const unmountedState: BoundaryBindingV1 = { runtimeComponentId: "worker/cms-publisher", capabilityName: "product-state.read", profileId: "production-v1", policyFingerprint: "policy:test" };
  // @ts-expect-error an unknown internal component cannot be supplied as a validated boundary
  const unmountedInternal: BoundaryBindingV1 = { runtimeComponentId: "runtime/not-in-manifest", capabilityName: "retention.execute", profileId: "production-v1", policyFingerprint: "policy:test" };
  // @ts-expect-error opaque profiles can only be returned by the fail-closed parser
  const directProfile: WorkerRuntimeProfileV1 = profile;
  // @ts-expect-error adapter component/provider triples cannot be supplied as an unvalidated literal
  const mismatchedAdapter: BoundaryBindingV1 = { runtimeComponentId: "adapter/search.query/builtin:mock", capabilityName: "search.query", profileId: "offline-test-v1", policyFingerprint: "policy:test", providerRef: "builtin:llm-simulation" };
  // @ts-expect-error raw provider strings cannot masquerade as a validated ProviderRefV1
  const rawProvider: ProviderRefV1 = "builtin:";
  // @ts-expect-error raw credential strings cannot masquerade as a validated CredentialRefV1
  const rawCredential: CredentialRefV1 = "env:";
  void [adapterWithoutProvider, stateWithProvider, unmountedState, unmountedInternal, directProfile, mismatchedAdapter, rawProvider, rawCredential];
}
function productionProfile(): WorkerRuntimeProfileInputV1 {
  return {
    ...profile,
    profileId: "production-v1",
    enabledWorkers: ["geo-run", "page-audit", "content-analysis", "report", "brand-monitor", "scheduler"],
    allowedTriggers: ["manual", "operator-replay", "scheduled", "retry"],
    capabilityPolicies: productionPolicies,
    providerEgress: "allowlisted",
    providerAllowlist: ["provider://search@v1"],
    queueBindings: [{ logicalName: "geo-run", prefix: "geo-seo:production:v1:task-1", scopeId: "task-1" }],
    providerBindings: [{ runtimeComponentId: "adapter/search.query/provider://search@v1", capabilityName: "search.query", profileId: "production-v1", policyFingerprint: "policy:production", providerRef: "provider://search@v1", credentialRef: "env:SEARCH_TOKEN" }],
    evidence: "required",
  };
}
function productionReceipt(profileValue: WorkerRuntimeProfileInputV1) {
  return { scopeId: "task-1", infrastructureBindings: profileValue.infrastructureConnections.map((binding) => ({ ...binding })), queueBindings: profileValue.queueBindings.map((binding) => ({ ...binding })) };
}

describe("Capability policy v1", () => {
  it("covers every closed capability and denies unknown or missing capability values", () => {
    expect(CAPABILITY_NAMES_V1.map((name) => effectiveCapabilityPolicyV1(profile, name))).toEqual(Object.values(policies));
    expect(effectiveCapabilityPolicyV1(profile, "future.effect")).toBe("deny");
    expect(effectiveCapabilityPolicyV1(undefined, "llm.complete")).toBe("deny");
    const missing = { ...profile, capabilityPolicies: { ...policies } } as unknown as { capabilityPolicies: Record<string, string> };
    delete missing.capabilityPolicies["artifact.write"];
    expect(parseWorkerRuntimeProfileV1({ ...profile, capabilityPolicies: missing.capabilityPolicies })).toMatchObject({ ok: false, reasonCode: "CAPABILITY_POLICY_INVALID" });
  });

  it("keeps the pre-import static manifest closed and complete", () => {
    const manifestCapabilities = new Set([
      ...Object.values(STATIC_WORKER_CAPABILITY_MANIFEST_V1).flat(),
      ...Object.values(STATIC_RUNTIME_COMPONENT_CAPABILITY_MANIFEST_V1).flat(),
    ]);
    expect([...manifestCapabilities].sort()).toEqual([...CAPABILITY_NAMES_V1].sort());
    expect(checkStaticManifestCapabilityV1("geo-run", "llm.complete")).toEqual({ allowed: true, reasonCode: "MOUNT_ALLOWED" });
    expect(checkStaticManifestCapabilityV1("geo-run", "cms.publish")).toEqual({ allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" });
    expect(checkStaticManifestCapabilityV1("unknown-worker", "llm.complete")).toEqual({ allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" });
    expect(checkStaticManifestComponentCapabilityV1("runtime/alert-retention", "retention.execute")).toEqual({ allowed: true, reasonCode: "MOUNT_ALLOWED" });
    expect(checkStaticManifestComponentCapabilityV1("runtime/unknown", "retention.execute")).toEqual({ allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" });
    expect(checkStaticManifestComponentCapabilityV1("constructor", "retention.execute")).toEqual({ allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" });
    expect(checkStaticManifestComponentCapabilityV1("toString", "retention.execute")).toEqual({ allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" });
    expect(Object.isFrozen(STATIC_WORKER_CAPABILITY_MANIFEST_V1)).toBe(true);
    expect(Object.isFrozen(STATIC_WORKER_CAPABILITY_MANIFEST_V1["geo-run"])).toBe(true);
    expect(Object.isFrozen(STATIC_RUNTIME_COMPONENT_CAPABILITY_MANIFEST_V1["runtime/alert-retention"])).toBe(true);
  });

  it("validates provider and credential reference shapes, while offline rejects credentials", () => {
    expect(isProviderRefV1("builtin:mock")).toBe(true);
    expect(isProviderRefV1("provider://search@v1")).toBe(true);
    expect(isProviderRefV1("https://provider.example")).toBe(false);
    expect(isCredentialRefV1("env:API_TOKEN")).toBe(true);
    expect(isCredentialRefV1("secret://geo/provider#v1")).toBe(true);
    expect(isCredentialRefV1("env:api-token")).toBe(false);
    expect(parseWorkerRuntimeProfileV1({ ...profile, providerBindings: [{ ...profile.providerBindings[0], credentialRef: "env:API_TOKEN" }, profile.providerBindings[1]] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
  });

  it("accepts only bounded non-secret receipt, approval, and policy references", () => {
    expect(isResourceReceiptRefV1("receipt:pg-1")).toBe(true);
    expect(isApprovalCheckpointRefV1("approval:checkpoint-1")).toBe(true);
    expect(isPolicyFingerprintV1("policy:offline.v1")).toBe(true);
    expect(isPolicyFingerprintV1(`sha256:${"a".repeat(64)}`)).toBe(true);
    for (const value of ["receipt:https://x", "receipt:bad?query", "receipt:bad@ref", "receipt:bad space", `receipt:${"a".repeat(129)}`]) expect(isResourceReceiptRefV1(value)).toBe(false);
    for (const value of ["approval:https://x", "approval:bad?query", "approval:bad\ncontrol", `approval:${"a".repeat(129)}`]) expect(isApprovalCheckpointRefV1(value)).toBe(false);
    for (const value of ["policy:https://x", "policy:bad?query", "sha256:ABC", `policy:${"a".repeat(129)}`]) expect(isPolicyFingerprintV1(value)).toBe(false);
  });

  it("rejects conflicting, denied, miswired, or impersonated boundary bindings", () => {
    expect(parseWorkerRuntimeProfileV1({ ...profile, providerBindings: [...profile.providerBindings, profile.providerBindings[0]] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
    expect(parseWorkerRuntimeProfileV1({ ...profile, providerBindings: [{ ...profile.providerBindings[0], runtimeComponentId: "adapter/llm.complete/builtin:llm-simulation" }, profile.providerBindings[1]] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
    expect(parseWorkerRuntimeProfileV1({ ...profile, providerBindings: [...profile.providerBindings, { runtimeComponentId: "adapter/web.crawl/builtin:mock", capabilityName: "web.crawl", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:mock" }] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
    expect(parseWorkerRuntimeProfileV1({ ...profile, queueBindings: [{ logicalName: "scheduler", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" }] })).toMatchObject({ ok: false, reasonCode: "QUEUE_BINDING_INVALID" });
    expect(parseWorkerRuntimeProfileV1({ ...profile, providerBindings: [{ ...profile.providerBindings[0], queueBinding: { logicalName: "geo-run", prefix: "geo-seo:offline-test:v1:other", scopeId: "other" } }, profile.providerBindings[1]] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
  });

  it("admits adapter factories only after runtime validation and deep-copies queue input", () => {
    const adapter = { runtimeComponentId: "adapter/search.query/builtin:llm-simulation", capabilityName: "search.query", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:llm-simulation" };
    const queue = { logicalName: "geo-run", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" };
    expect(createAdapterBoundaryBindingV1(adapter)).toMatchObject(adapter);
    expect(createAdapterBoundaryBindingV1({ ...adapter, runtimeComponentId: "adapter/search.query/builtin:mock" })).toBeUndefined();
    expect(createAdapterBoundaryBindingV1({ ...adapter, runtimeComponentId: "worker/geo-run" })).toBeUndefined();
    expect(createAdapterBoundaryBindingV1({ ...adapter, capabilityName: "not-a-capability" })).toBeUndefined();
    expect(createAdapterBoundaryBindingV1({ ...adapter, profileId: "unknown-profile" })).toBeUndefined();
    expect(createAdapterBoundaryBindingV1({ ...adapter, credentialRef: "env:SEARCH_TOKEN" })).toBeUndefined();
    expect(createAdapterBoundaryBindingV1({ ...adapter, queueBinding: { ...queue, prefix: "bad namespace" } }, [queue])).toBeUndefined();
    const queued = createAdapterBoundaryBindingV1({ ...adapter, queueBinding: queue }, [queue]);
    expect(queued).toMatchObject({ queueBinding: queue });
    queue.prefix = "mutated";
    expect(queued?.queueBinding?.prefix).toBe("geo-seo:offline-test:v1:task-1");
    expect(Object.isFrozen(queued?.queueBinding)).toBe(true);
  });

  it("requires production registry entries for nonbuiltin bindings and rejects unbound registry credentials", () => {
    const production = productionProfile();
    const taskReceipt = productionReceipt(production);
    expect(resolveRuntimeProfileV1({ selector: "production-v1", immutableProfile: production, taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: ["provider://search@v1"], credentialRefs: ["env:SEARCH_TOKEN"] } })).toMatchObject({ ok: true });
    expect(resolveRuntimeProfileV1({ selector: "production-v1", immutableProfile: production, taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: [], credentialRefs: ["env:SEARCH_TOKEN"] } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "production-v1", immutableProfile: production, taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: ["provider://search@v1"], credentialRefs: ["env:OTHER_TOKEN"] } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
    expect(resolveRuntimeProfileV1({ selector: "production-v1", immutableProfile: production, taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: ["provider://other@v1"], credentialRefs: ["env:SEARCH_TOKEN"] } })).toMatchObject({ ok: false, reasonCode: "PROFILE_PRECEDENCE_VIOLATION" });
  });

  it("allows distinct enabled state bindings and the closed alert-retention runtime, but rejects an unmanifested worker", () => {
    const production = productionProfile();
    const bindings = [
      ...production.providerBindings,
      { runtimeComponentId: "worker/geo-run", capabilityName: "product-state.read", profileId: "production-v1", policyFingerprint: "policy:production" },
      { runtimeComponentId: "worker/brand-monitor", capabilityName: "product-state.read", profileId: "production-v1", policyFingerprint: "policy:production" },
      { runtimeComponentId: "runtime/alert-retention", capabilityName: "retention.execute", profileId: "production-v1", policyFingerprint: "policy:production" },
    ];
    expect(parseWorkerRuntimeProfileV1({ ...production, providerBindings: bindings })).toMatchObject({ ok: true });
    expect(parseWorkerRuntimeProfileV1({ ...production, providerBindings: [{ ...bindings[1], runtimeComponentId: "worker/cms-publisher" }, ...bindings.filter((_, index) => index !== 1)] })).toMatchObject({ ok: false, reasonCode: "REFERENCE_INVALID" });
  });

  it("admits a legacy Bull namespace only when its full receipt tuple matches", () => {
    const production = productionProfile();
    const legacy = {
      ...production,
      profileId: "legacy-all-v0" as const,
      queueBindings: [{ logicalName: "geo-run", prefix: "bull", scopeId: "task-1" }],
      providerBindings: production.providerBindings.map((binding) => ({ ...binding, profileId: "legacy-all-v0" as const })),
    };
    const taskReceipt = productionReceipt(legacy);
    expect(resolveRuntimeProfileV1({ selector: "legacy-all-v0", immutableProfile: legacy, taskResourceReceipt: taskReceipt, environmentRegistry: { providerRefs: ["provider://search@v1"], credentialRefs: ["env:SEARCH_TOKEN"] } })).toMatchObject({ ok: true });
    expect(resolveRuntimeProfileV1({ selector: "legacy-all-v0", immutableProfile: legacy, taskResourceReceipt: { ...taskReceipt, queueBindings: [{ logicalName: "geo-run", prefix: "bull-other", scopeId: "task-1" }] }, environmentRegistry: { providerRefs: ["provider://search@v1"], credentialRefs: ["env:SEARCH_TOKEN"] } })).toMatchObject({ ok: false, reasonCode: "RESOURCE_RECEIPT_MISSING" });
  });
});
