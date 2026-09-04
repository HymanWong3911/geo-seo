import { describe, expect, it } from "vitest";
import { parsePolicyDecisionV1 } from "@/workers/harness/runtime-profile";

describe("PolicyDecisionV1", () => {
  it("keeps policy decisions separate from provider, credential, and outcome data", () => {
    expect(parsePolicyDecisionV1({ decision: "allow", reasonCode: "INVOKE_ALLOWED", profileId: "offline-test-v1", policyFingerprint: "policy:offline" })).toMatchObject({ decision: "allow" });
    expect(parsePolicyDecisionV1({ decision: "deny", reasonCode: "NETWORK_DENIED", profileId: "offline-test-v1", policyFingerprint: "policy:offline", providerRef: "builtin:mock" })).toBeUndefined();
  });

  it("requires an allow result for an approval checkpoint and preserves defer semantics", () => {
    expect(parsePolicyDecisionV1({ decision: "deny", reasonCode: "APPROVAL_REQUIRED", profileId: "production-v1", policyFingerprint: "policy:p", approvalCheckpointRef: "approval:1" })).toBeUndefined();
    expect(parsePolicyDecisionV1({ decision: "defer", reasonCode: "APPROVAL_REQUIRED", profileId: "production-v1", policyFingerprint: "policy:p" })).toMatchObject({ decision: "defer" });
    expect(parsePolicyDecisionV1({ decision: "allow", reasonCode: "NETWORK_DENIED", profileId: "offline-test-v1", policyFingerprint: "policy:p" })).toBeUndefined();
    expect(parsePolicyDecisionV1({ decision: "deny", reasonCode: "MOUNT_ALLOWED", profileId: "offline-test-v1", policyFingerprint: "policy:p" })).toBeUndefined();
    expect(parsePolicyDecisionV1({ decision: "deny", reasonCode: "INVOKE_ALLOWED", profileId: "offline-test-v1", policyFingerprint: "policy:p" })).toBeUndefined();
    expect(parsePolicyDecisionV1({ decision: "allow", reasonCode: "MOUNT_ALLOWED", profileId: "offline-test-v1", policyFingerprint: "policy:p", approvalCheckpointRef: "approval:1" })).toBeUndefined();
  });

  it("returns a frozen clone rather than retaining caller-owned decision data", () => {
    const raw = { decision: "allow", reasonCode: "INVOKE_ALLOWED", profileId: "offline-test-v1", policyFingerprint: "policy:p", approvalCheckpointRef: "approval:1" } as const;
    const parsed = parsePolicyDecisionV1(raw);
    expect(parsed).toMatchObject(raw);
    expect(Object.isFrozen(parsed)).toBe(true);
    (raw as { policyFingerprint: string }).policyFingerprint = "mutated";
    expect(parsed?.policyFingerprint).toBe("policy:p");
  });
});
