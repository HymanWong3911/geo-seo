/** Pure QueueBinding v1 helpers; no queue client or configuration imports. */
export type QueueBindingV1 = Readonly<{ logicalName: string; prefix: string; scopeId: string }>;
export type QueueProfileIdV1 = "offline-test-v1" | "production-v1" | "legacy-all-v0";
declare const validatedQueueBinding: unique symbol;
declare const receiptBoundQueueBinding: unique symbol;
export type ValidatedQueueBindingV1 = QueueBindingV1 & Readonly<{ [validatedQueueBinding]: true }>;
export type ReceiptBoundQueueBindingV1 = ValidatedQueueBindingV1 & Readonly<{ [receiptBoundQueueBinding]: true }>;
export type QueueBindingValidation = Readonly<{ ok: true; binding: ValidatedQueueBindingV1 }> | Readonly<{ ok: false; reasonCode: "QUEUE_BINDING_INVALID" | "QUEUE_NAMESPACE_MISMATCH" }>;
export type QueueReceiptResolution = Readonly<{ ok: true; binding: ReceiptBoundQueueBindingV1; queueName: string }> | Readonly<{ ok: false; reasonCode: "QUEUE_BINDING_INVALID" | "QUEUE_NAMESPACE_MISMATCH" | "QUEUE_RECEIPT_MISMATCH" }>;
const SEGMENT = /^[a-z][a-z0-9-]*$/; const LEGACY_PREFIX = /^[a-z][a-z0-9:-]*$/;
/** A physical name can only be derived from a profile-and-receipt-bound brand. */
export function queueNameForBindingV1(binding: ReceiptBoundQueueBindingV1): string { return `${binding.prefix}:${binding.logicalName}`; }
export function validateQueueBindingV1(value: unknown): QueueBindingValidation {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["logicalName", "prefix", "scopeId"])) return invalid();
  const { logicalName, prefix, scopeId } = value;
  if (typeof logicalName !== "string" || !SEGMENT.test(logicalName) || typeof scopeId !== "string" || !SEGMENT.test(scopeId) || typeof prefix !== "string" || !LEGACY_PREFIX.test(prefix)) return invalid();
  return Object.freeze({ ok: true, binding: Object.freeze({ logicalName, prefix, scopeId }) as ValidatedQueueBindingV1 });
}
export function validateQueueBindingForProfileV1(value: unknown, profileId: QueueProfileIdV1): QueueBindingValidation {
  const parsed = validateQueueBindingV1(value); if (!parsed.ok) return parsed;
  const { prefix, scopeId } = parsed.binding;
  const allowed = profileId === "offline-test-v1" ? prefix === `geo-seo:offline-test:v1:${scopeId}` : profileId === "production-v1" ? prefix === `geo-seo:production:v1:${scopeId}` : !prefix.startsWith("geo-seo:offline-test:v1:") && !prefix.startsWith("geo-seo:production:v1:");
  return allowed ? parsed : invalid();
}
export function validateQueueNamespacePairV1(producer: unknown, consumer: unknown): QueueBindingValidation {
  const left = validateQueueBindingV1(producer), right = validateQueueBindingV1(consumer);
  return !left.ok || !right.ok ? invalid() : sameQueueBindingV1(left.binding, right.binding) ? left : Object.freeze({ ok: false, reasonCode: "QUEUE_NAMESPACE_MISMATCH" });
}
/** Validates the complete profile queue set against the receipt before exposing a physical name. */
export function resolveReceiptBoundQueueBindingV1(profileId: QueueProfileIdV1, profileQueueBindings: unknown, producer: unknown, consumer: unknown, receipt: unknown): QueueReceiptResolution {
  const left = validateQueueBindingForProfileV1(producer, profileId), right = validateQueueBindingForProfileV1(consumer, profileId);
  if (!left.ok || !right.ok) return receiptInvalid("QUEUE_BINDING_INVALID");
  if (!sameQueueBindingV1(left.binding, right.binding)) return receiptInvalid("QUEUE_NAMESPACE_MISMATCH");
  if (!isExactReceiptQueueSet(receipt, profileQueueBindings, left.binding, profileId)) return receiptInvalid("QUEUE_RECEIPT_MISMATCH");
  const binding = Object.freeze({ ...left.binding }) as ReceiptBoundQueueBindingV1;
  return Object.freeze({ ok: true, binding, queueName: queueNameForBindingV1(binding) });
}
export function sameQueueBindingV1(left: QueueBindingV1, right: QueueBindingV1): boolean { return left.logicalName === right.logicalName && left.prefix === right.prefix && left.scopeId === right.scopeId; }
function isExactReceiptQueueSet(receipt: unknown, profileQueues: unknown, binding: QueueBindingV1, profileId: QueueProfileIdV1): boolean {
  if (!isPlainRecord(receipt) || receipt.scopeId !== binding.scopeId || !Array.isArray(receipt.queueBindings) || !Array.isArray(profileQueues)) return false;
  if (!profileQueues.every((queue) => validateQueueBindingForProfileV1(queue, profileId).ok) || !receipt.queueBindings.every((queue) => validateQueueBindingForProfileV1(queue, profileId).ok)) return false;
  if (!profileQueues.every((queue) => isPlainRecord(queue) && queue.scopeId === binding.scopeId) || !receipt.queueBindings.every((queue) => isPlainRecord(queue) && queue.scopeId === binding.scopeId)) return false;
  return exactSet(profileQueues as QueueBindingV1[], receipt.queueBindings as QueueBindingV1[]) && profileQueues.filter((queue) => sameQueueBindingV1(queue as QueueBindingV1, binding)).length === 1;
}
function exactSet(left: readonly QueueBindingV1[], right: readonly QueueBindingV1[]): boolean { return left.length === right.length && new Set(left.map(key)).size === left.length && new Set(right.map(key)).size === right.length && left.every((binding) => new Set(right.map(key)).has(key(binding))); }
function key(binding: QueueBindingV1): string { return `${binding.logicalName}|${binding.prefix}|${binding.scopeId}`; }
function invalid(): QueueBindingValidation { return Object.freeze({ ok: false, reasonCode: "QUEUE_BINDING_INVALID" }); }
function receiptInvalid(reasonCode: "QUEUE_BINDING_INVALID" | "QUEUE_NAMESPACE_MISMATCH" | "QUEUE_RECEIPT_MISMATCH"): QueueReceiptResolution { return Object.freeze({ ok: false, reasonCode }); }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { const actual = Object.keys(value); return actual.length === keys.length && actual.every((key) => keys.includes(key)); }
