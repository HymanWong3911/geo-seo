import { describe, expect, it } from "vitest";
import { queueNameForBindingV1, resolveReceiptBoundQueueBindingV1, validateQueueBindingForProfileV1, validateQueueBindingV1, validateQueueNamespacePairV1 } from "@/workers/harness/queue-binding";

const binding = { logicalName: "geo-run", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" } as const;
describe("QueueBindingV1", () => {
  it("exposes a physical name only after full profile queue-set and receipt validation", () => {
    const raw = validateQueueBindingV1(binding);
    expect(raw).toMatchObject({ ok: true });
    if (raw.ok) expect(Object.isFrozen(raw.binding)).toBe(true);
    const resolved = resolveReceiptBoundQueueBindingV1("offline-test-v1", [binding], binding, binding, { scopeId: "task-1", queueBindings: [binding] });
    expect(resolved).toMatchObject({ ok: true, queueName: "geo-seo:offline-test:v1:task-1:geo-run" });
    if (resolved.ok) expect(queueNameForBindingV1(resolved.binding)).toBe("geo-seo:offline-test:v1:task-1:geo-run");
    if (false && raw.ok) {
      // @ts-expect-error profile-only validation cannot provide a physical queue name
      queueNameForBindingV1(raw.binding);
    }
  });
  it("rejects malformed, mismatched, foreign, and extra receipt namespaces", () => {
    expect(validateQueueBindingV1({ ...binding, prefix: "" })).toEqual({ ok: false, reasonCode: "QUEUE_BINDING_INVALID" });
    expect(validateQueueNamespacePairV1(binding, { ...binding, prefix: "geo-seo:offline-test:v1:task-2", scopeId: "task-2" })).toEqual({ ok: false, reasonCode: "QUEUE_NAMESPACE_MISMATCH" });
    expect(validateQueueBindingForProfileV1({ logicalName: "geo-run", prefix: "bull", scopeId: "task-1" }, "legacy-all-v0")).toMatchObject({ ok: true });
    expect(resolveReceiptBoundQueueBindingV1("offline-test-v1", [binding], binding, binding, { scopeId: "foreign", queueBindings: [binding] })).toEqual({ ok: false, reasonCode: "QUEUE_RECEIPT_MISMATCH" });
    expect(resolveReceiptBoundQueueBindingV1("offline-test-v1", [binding], binding, binding, { scopeId: "task-1", queueBindings: [binding, { logicalName: "scheduler", prefix: "geo-seo:offline-test:v1:task-1", scopeId: "task-1" }] })).toEqual({ ok: false, reasonCode: "QUEUE_RECEIPT_MISMATCH" });
  });

  it("requires the receipt even for a legacy Bull namespace", () => {
    const legacy = { logicalName: "geo-run", prefix: "bull", scopeId: "task-1" } as const;
    expect(resolveReceiptBoundQueueBindingV1("legacy-all-v0", [legacy], legacy, legacy, { scopeId: "task-1", queueBindings: [legacy] })).toMatchObject({ ok: true, queueName: "bull:geo-run" });
    expect(resolveReceiptBoundQueueBindingV1("legacy-all-v0", [legacy], legacy, legacy, { scopeId: "task-1", queueBindings: [] })).toEqual({ ok: false, reasonCode: "QUEUE_RECEIPT_MISMATCH" });
  });
});
