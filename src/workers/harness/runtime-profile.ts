import type { QueueBindingV1 } from "./queue-binding";
import { sameQueueBindingV1, validateQueueBindingForProfileV1, validateQueueBindingV1 } from "./queue-binding";
import { checkStaticManifestComponentCapabilityV1 } from "./static-manifest";

export const WORKER_RUNTIME_PROFILE_CONTRACT_V1 = "geo-seo.worker-runtime-profile.v1" as const;
export const CAPABILITY_NAMES_V1 = ["search.query", "llm.complete", "product-state.read", "product-state.write", "web.crawl", "notification.send", "schedule.register", "retention.execute", "artifact.write", "cms.publish", "content.distribute"] as const;
export const WORKER_IDS_V1 = ["geo-run", "page-audit", "content-analysis", "report", "brand-monitor", "scheduler", "cms-publisher", "distribution"] as const;
export const TRIGGER_IDS_V1 = ["manual", "operator-replay", "scheduled", "retry", "system-startup"] as const;
export const PROFILE_IDS_V1 = ["offline-test-v1", "production-v1", "legacy-all-v0"] as const;
export type CapabilityNameV1 = (typeof CAPABILITY_NAMES_V1)[number];
export type WorkerIdV1 = (typeof WORKER_IDS_V1)[number];
export type TriggerIdV1 = (typeof TRIGGER_IDS_V1)[number];
export type ProfileIdV1 = (typeof PROFILE_IDS_V1)[number];
export type RuntimeComponentIdV1 = `worker/${WorkerIdV1}` | `adapter/${CapabilityNameV1}/${ProviderRefV1}` | `runtime/${string}` | `sink/${string}`;
export type CapabilityPolicyV1 = "deny" | "synthetic" | "isolated-state" | "allowlisted";
export type PolicyDecisionKindV1 = "allow" | "deny" | "defer";
export type PolicyReasonCodeV1 = "MOUNT_ALLOWED" | "INVOKE_ALLOWED" | "PROFILE_NOT_ALLOWED" | "CAPABILITY_NOT_MOUNTED" | "TRIGGER_NOT_ALLOWED" | "NETWORK_DENIED" | "APPROVAL_REQUIRED" | "CREDENTIAL_REFERENCE_INVALID" | "DEPENDENCY_UNHEALTHY" | "IDEMPOTENCY_CONFLICT" | "POLICY_VIOLATION";

declare const validatedReference: unique symbol;
declare const validatedProviderRef: unique symbol;
declare const validatedCredentialRef: unique symbol;
declare const validatedInputRef: unique symbol;
declare const validatedBoundaryBinding: unique symbol;
declare const validatedRuntimeProfile: unique symbol;
type Opaque<T, Brand extends symbol> = T & Readonly<{ [K in Brand]: true }>;
export type ProviderRefV1 = Opaque<`builtin:${string}` | `provider://${string}@${string}`, typeof validatedProviderRef>;
export type CredentialRefV1 = Opaque<`env:${string}` | `secret://${string}#${string}`, typeof validatedCredentialRef>;
export type SafeReferenceIdV1 = Opaque<string, typeof validatedReference>;
export type ResourceReceiptRefV1 = Opaque<`receipt:${string}`, typeof validatedReference>;
export type ApprovalCheckpointRefV1 = Opaque<`approval:${string}`, typeof validatedReference>;
export type PolicyFingerprintV1 = Opaque<`policy:${string}` | `sha256:${string}`, typeof validatedReference>;
export type RawInputRefV1 = Readonly<{ kind: "product-input"; ref: string }> | Readonly<{ kind: "artifact"; ref: string }>;
export type InputRefV1 = Opaque<Readonly<{ kind: "product-input"; ref: `input:${string}` }> | Readonly<{ kind: "artifact"; ref: `artifact:${string}` }>, typeof validatedInputRef>;
export type ExecutionContextV1<TInput extends RawInputRefV1 = RawInputRefV1> = Readonly<{ runId: string; stageId: string; attempt: number; trigger: TriggerIdV1; idempotencyKey: string; input: TInput; deadline?: string }>;
declare const validatedExecutionContext: unique symbol;
export type ValidatedExecutionContextV1<TInput extends InputRefV1 = InputRefV1> = Omit<ExecutionContextV1, "input"> & Readonly<{ input: TInput; [validatedExecutionContext]: true }>;
export type ExecutionContextValidationV1 = Readonly<{ ok: true; context: ValidatedExecutionContextV1 }> | Readonly<{ ok: false; reasonCode: "EXECUTION_CONTEXT_INVALID" | "TRIGGER_NOT_ALLOWED" }>;
export interface CapabilityPortV1<TInput extends InputRefV1, TOutput> { readonly capabilityName: CapabilityNameV1; execute(context: ValidatedExecutionContextV1<TInput>): Promise<TOutput>; }
export type PolicyDecisionV1 = Readonly<{ decision: PolicyDecisionKindV1; reasonCode: PolicyReasonCodeV1; profileId: ProfileIdV1; policyFingerprint: PolicyFingerprintV1; approvalCheckpointRef?: ApprovalCheckpointRefV1 }>;
export type RawInfrastructureBindingV1 = Readonly<{ kind: "postgres" | "redis" | "web"; bindingId: string; addressHost: string; addressPort: number; networkMode: "docker-internal" | "loopback"; resourceReceiptRef: string }>;
export type InfrastructureBindingV1 = Opaque<Omit<RawInfrastructureBindingV1, "resourceReceiptRef"> & Readonly<{ resourceReceiptRef: ResourceReceiptRefV1 }>, typeof validatedRuntimeProfile>;
type BindingBaseV1 = Readonly<{ profileId: ProfileIdV1; policyFingerprint: PolicyFingerprintV1; queueBinding?: QueueBindingV1 }>;
type ProviderBackedCapabilityV1 = Exclude<CapabilityNameV1, "product-state.read" | "product-state.write">;
type AdapterBindingV1 = { [C in ProviderBackedCapabilityV1]: BindingBaseV1 & Readonly<{ runtimeComponentId: `adapter/${C}/${ProviderRefV1}`; capabilityName: C; providerRef: ProviderRefV1; credentialRef?: CredentialRefV1 }> }[ProviderBackedCapabilityV1];
type StateBindingV1<C extends "product-state.read" | "product-state.write" = "product-state.read" | "product-state.write"> = BindingBaseV1 & Readonly<{ runtimeComponentId: `worker/${WorkerIdV1}`; capabilityName: C; providerRef?: never; credentialRef?: never }>;
type InternalBindingV1 = BindingBaseV1 & Readonly<{ runtimeComponentId: `runtime/${string}` | `sink/${string}`; capabilityName: ProviderBackedCapabilityV1; providerRef?: never; credentialRef?: never }>;
type ValidatedBoundaryBindingV1 = AdapterBindingV1 | StateBindingV1 | InternalBindingV1;
export type BoundaryBindingV1 = Opaque<ValidatedBoundaryBindingV1, typeof validatedBoundaryBinding>;
export type BoundaryBindingInputV1 = Readonly<{ runtimeComponentId: string; capabilityName: string; profileId: string; policyFingerprint: string; providerRef?: string; credentialRef?: string; queueBinding?: QueueBindingV1 }>;
export type TaskResourceReceiptV1 = Readonly<{ scopeId: string; infrastructureBindings: readonly RawInfrastructureBindingV1[]; queueBindings: readonly QueueBindingV1[] }>;
export type EnvironmentRegistryV1 = Readonly<{ providerRefs: readonly ProviderRefV1[]; credentialRefs: readonly CredentialRefV1[] }>;
export type WorkerRuntimeProfileInputV1 = Readonly<{ profileId: ProfileIdV1; contractVersion: typeof WORKER_RUNTIME_PROFILE_CONTRACT_V1; enabledWorkers: readonly WorkerIdV1[]; allowedTriggers: readonly TriggerIdV1[]; capabilityPolicies: Readonly<Record<CapabilityNameV1, CapabilityPolicyV1>>; providerEgress: "deny" | "allowlisted"; providerAllowlist: readonly string[]; infrastructureConnections: readonly RawInfrastructureBindingV1[]; queueBindings: readonly QueueBindingV1[]; providerBindings: readonly BoundaryBindingInputV1[]; externalWrite: "deny"; humanApprovalForExternalWrite: true; evidence: "contract-only" | "required" }>;
type ValidatedWorkerRuntimeProfileV1 = Readonly<{ profileId: ProfileIdV1; contractVersion: typeof WORKER_RUNTIME_PROFILE_CONTRACT_V1; enabledWorkers: readonly WorkerIdV1[]; allowedTriggers: readonly TriggerIdV1[]; capabilityPolicies: Readonly<Record<CapabilityNameV1, CapabilityPolicyV1>>; providerEgress: "deny" | "allowlisted"; providerAllowlist: readonly ProviderRefV1[]; infrastructureConnections: readonly InfrastructureBindingV1[]; queueBindings: readonly QueueBindingV1[]; providerBindings: readonly BoundaryBindingV1[]; externalWrite: "deny"; humanApprovalForExternalWrite: true; evidence: "contract-only" | "required" }>;
export type WorkerRuntimeProfileV1 = Opaque<ValidatedWorkerRuntimeProfileV1, typeof validatedRuntimeProfile>;
export type ProfileValidationReasonV1 = "PROFILE_MISSING" | "PROFILE_UNKNOWN" | "PROFILE_INVALID" | "PROFILE_VERSION_INVALID" | "PROFILE_PRECEDENCE_VIOLATION" | "SAFETY_FLOOR_VIOLATION" | "CAPABILITY_POLICY_INVALID" | "REFERENCE_INVALID" | "QUEUE_BINDING_INVALID" | "RESOURCE_RECEIPT_MISSING";
export type ProfileValidationResultV1 = Readonly<{ ok: true; profile: WorkerRuntimeProfileV1 }> | Readonly<{ ok: false; exitCode: 78; reasonCode: ProfileValidationReasonV1; field?: string }>;

const PROFILE_KEYS = ["profileId", "contractVersion", "enabledWorkers", "allowedTriggers", "capabilityPolicies", "providerEgress", "providerAllowlist", "infrastructureConnections", "queueBindings", "providerBindings", "externalWrite", "humanApprovalForExternalWrite", "evidence"] as const;
const STATE_CAPABILITIES = new Set<CapabilityNameV1>(["product-state.read", "product-state.write"]);
const POLICY_BY_PROFILE: Readonly<Record<ProfileIdV1, Readonly<Record<CapabilityNameV1, CapabilityPolicyV1>>>> = Object.freeze({
  "offline-test-v1": { "search.query": "synthetic", "llm.complete": "synthetic", "product-state.read": "isolated-state", "product-state.write": "isolated-state", "web.crawl": "deny", "notification.send": "deny", "schedule.register": "deny", "retention.execute": "deny", "artifact.write": "deny", "cms.publish": "deny", "content.distribute": "deny" },
  "production-v1": { "search.query": "allowlisted", "llm.complete": "allowlisted", "product-state.read": "allowlisted", "product-state.write": "allowlisted", "web.crawl": "allowlisted", "notification.send": "deny", "schedule.register": "allowlisted", "retention.execute": "allowlisted", "artifact.write": "allowlisted", "cms.publish": "deny", "content.distribute": "deny" },
  "legacy-all-v0": { "search.query": "allowlisted", "llm.complete": "allowlisted", "product-state.read": "allowlisted", "product-state.write": "allowlisted", "web.crawl": "allowlisted", "notification.send": "deny", "schedule.register": "allowlisted", "retention.execute": "allowlisted", "artifact.write": "allowlisted", "cms.publish": "deny", "content.distribute": "deny" },
});

export function effectiveCapabilityPolicyV1(profile: Pick<WorkerRuntimeProfileInputV1, "capabilityPolicies"> | Pick<WorkerRuntimeProfileV1, "capabilityPolicies"> | undefined, capabilityName: unknown): CapabilityPolicyV1 {
  if (!profile || !isCapabilityNameV1(capabilityName)) return "deny";
  return isCapabilityPolicyV1(profile.capabilityPolicies[capabilityName]) ? profile.capabilityPolicies[capabilityName] : "deny";
}

/** Exact, fail-closed context admission before a CapabilityPort may receive it. */
export function validateExecutionContextV1(value: unknown, allowedTriggers: readonly TriggerIdV1[]): ExecutionContextValidationV1 {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["runId", "stageId", "attempt", "trigger", "idempotencyKey", "input", "deadline"]) || !hasRequiredKeys(value, ["runId", "stageId", "attempt", "trigger", "idempotencyKey", "input"])) return Object.freeze({ ok: false, reasonCode: "EXECUTION_CONTEXT_INVALID" });
  if (!isRef(value.runId) || !isRef(value.stageId) || !isRef(value.idempotencyKey) || typeof value.attempt !== "number" || !Number.isInteger(value.attempt) || value.attempt < 1 || !isInputRef(value.input) || value.deadline !== undefined && !isRfc3339Utc(value.deadline)) return Object.freeze({ ok: false, reasonCode: "EXECUTION_CONTEXT_INVALID" });
  if (!isTriggerIdV1(value.trigger) || !allowedTriggers.includes(value.trigger)) return Object.freeze({ ok: false, reasonCode: "TRIGGER_NOT_ALLOWED" });
  const input = Object.freeze({ ...value.input }) as InputRefV1;
  return Object.freeze({ ok: true, context: Object.freeze({ runId: value.runId, stageId: value.stageId, attempt: value.attempt, trigger: value.trigger, idempotencyKey: value.idempotencyKey, input, ...(value.deadline === undefined ? {} : { deadline: value.deadline }) }) as ValidatedExecutionContextV1 });
}
export const parseExecutionContextV1 = validateExecutionContextV1;

export function parseWorkerRuntimeProfileV1(value: unknown): ProfileValidationResultV1 {
  if (value == null) return reject("PROFILE_MISSING", "profile");
  if (!isPlainRecord(value)) return reject("PROFILE_INVALID", "profile");
  if (typeof value.profileId !== "string" || !isProfileIdV1(value.profileId)) return reject("PROFILE_UNKNOWN", "profileId");
  if (!hasExactKeys(value, PROFILE_KEYS)) return reject("PROFILE_INVALID", "profile");
  const profileId = value.profileId;
  if (value.contractVersion !== WORKER_RUNTIME_PROFILE_CONTRACT_V1) return reject("PROFILE_VERSION_INVALID", "contractVersion");
  if (value.externalWrite !== "deny" || value.humanApprovalForExternalWrite !== true) return reject("SAFETY_FLOOR_VIOLATION", "externalWrite");
  if (!isClosedSet(value.enabledWorkers, WORKER_IDS_V1) || !isClosedSet(value.allowedTriggers, TRIGGER_IDS_V1)) return reject("PROFILE_INVALID", "workers-or-triggers");
  if (!hasExactPolicies(value.capabilityPolicies, profileId)) return reject("CAPABILITY_POLICY_INVALID", "capabilityPolicies");
  if (!isProviderEgress(value.providerEgress) || !isUniqueRefs(value.providerAllowlist, isProviderRefV1)) return reject("REFERENCE_INVALID", "providerAllowlist");
  if (value.providerEgress === "deny" && value.providerAllowlist.length !== 0) return reject("PROFILE_INVALID", "providerAllowlist");
  if (profileId !== "offline-test-v1" && value.providerAllowlist.length === 0) return reject("PROFILE_INVALID", "providerAllowlist");
  if (!isInfrastructureList(value.infrastructureConnections, profileId)) return reject("RESOURCE_RECEIPT_MISSING", "infrastructureConnections");
  if (!isQueueList(value.queueBindings, profileId, value.enabledWorkers)) return reject("QUEUE_BINDING_INVALID", "queueBindings");
  if (!isBoundaryList(value.providerBindings, profileId, value.capabilityPolicies, value.queueBindings, value.providerAllowlist, value.enabledWorkers)) return reject("REFERENCE_INVALID", "providerBindings");
  if (!isEvidence(value.evidence) || !matchesProfileSemantics(value, profileId)) return reject("PROFILE_INVALID", "profileSemantics");
  return Object.freeze({ ok: true, profile: normalizeProfile(value as WorkerRuntimeProfileInputV1) });
}

export function resolveRuntimeProfileV1(input: Readonly<{ selector?: unknown; immutableProfile?: unknown; taskResourceReceipt?: unknown; environmentRegistry?: unknown; perRun?: unknown }>): ProfileValidationResultV1 {
  if (input.selector === undefined) return reject("PROFILE_MISSING", "selector");
  if (!isProfileIdV1(input.selector)) return reject("PROFILE_UNKNOWN", "selector");
  const parsed = parseWorkerRuntimeProfileV1(input.immutableProfile);
  if (!parsed.ok) return parsed;
  if (parsed.profile.profileId !== input.selector) return reject("PROFILE_PRECEDENCE_VIOLATION", "selector");
  if (!isTaskReceipt(input.taskResourceReceipt) || !receiptMatches(parsed.profile, input.taskResourceReceipt)) return reject("RESOURCE_RECEIPT_MISSING", "taskResourceReceipt");
  if (!isEnvironmentRegistry(input.environmentRegistry) || !registryMatches(parsed.profile, input.environmentRegistry)) return reject("PROFILE_PRECEDENCE_VIOLATION", "environmentRegistry");
  if (!isPerRunInput(input.perRun, parsed.profile.allowedTriggers)) return reject("PROFILE_PRECEDENCE_VIOLATION", "perRun");
  return parsed;
}

export function parsePolicyDecisionV1(value: unknown): PolicyDecisionV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["decision", "reasonCode", "profileId", "policyFingerprint", "approvalCheckpointRef"])) return undefined;
  if (!isDecision(value.decision) || !isReason(value.reasonCode) || !isProfileIdV1(value.profileId) || !isPolicyFingerprintV1(value.policyFingerprint)) return undefined;
  if (value.approvalCheckpointRef !== undefined && (!isApprovalCheckpointRefV1(value.approvalCheckpointRef) || value.decision !== "allow" || value.reasonCode !== "INVOKE_ALLOWED")) return undefined;
  if (value.decision === "allow") return ["MOUNT_ALLOWED", "INVOKE_ALLOWED"].includes(value.reasonCode) ? freezeDecision(value) : undefined;
  if (value.decision === "defer") return ["APPROVAL_REQUIRED", "DEPENDENCY_UNHEALTHY"].includes(value.reasonCode) ? freezeDecision(value) : undefined;
  return !["MOUNT_ALLOWED", "INVOKE_ALLOWED", "APPROVAL_REQUIRED", "DEPENDENCY_UNHEALTHY"].includes(value.reasonCode) ? freezeDecision(value) : undefined;
}

export function isProviderRefV1(value: unknown): value is ProviderRefV1 { return typeof value === "string" && (/^builtin:[a-z][a-z0-9-]*$/.test(value) || /^provider:\/\/[a-z][a-z0-9-]*@[a-z0-9][a-z0-9._-]*$/.test(value)); }
export function isCredentialRefV1(value: unknown): value is CredentialRefV1 { return typeof value === "string" && (/^env:[A-Z][A-Z0-9_]*$/.test(value) || /^secret:\/\/[a-z0-9][a-z0-9/_-]*#[a-z0-9][a-z0-9._-]*$/.test(value)); }
export function isResourceReceiptRefV1(value: unknown): value is ResourceReceiptRefV1 { return typeof value === "string" && value.startsWith("receipt:") && isSafeReferenceId(value.slice("receipt:".length)); }
export function isApprovalCheckpointRefV1(value: unknown): value is ApprovalCheckpointRefV1 { return typeof value === "string" && value.startsWith("approval:") && isSafeReferenceId(value.slice("approval:".length)); }
export function isPolicyFingerprintV1(value: unknown): value is PolicyFingerprintV1 { return typeof value === "string" && (value.startsWith("policy:") && isSafeReferenceId(value.slice("policy:".length)) || /^sha256:[a-f0-9]{64}$/.test(value)); }

/** Public factory admits untyped boundary input only after complete local validation. Queue input additionally needs its profile queue context. */
export function createAdapterBoundaryBindingV1(value: unknown, profileQueueBindings?: unknown): BoundaryBindingV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["runtimeComponentId", "capabilityName", "profileId", "policyFingerprint", "providerRef", "credentialRef", "queueBinding"]) || !hasRequiredKeys(value, ["runtimeComponentId", "capabilityName", "profileId", "policyFingerprint", "providerRef"])) return undefined;
  if (!isProfileIdV1(value.profileId) || !isCapabilityNameV1(value.capabilityName) || STATE_CAPABILITIES.has(value.capabilityName) || POLICY_BY_PROFILE[value.profileId][value.capabilityName] === "deny" || typeof value.runtimeComponentId !== "string" || !isProviderRefV1(value.providerRef) || !isPolicyFingerprintV1(value.policyFingerprint) || value.runtimeComponentId !== `adapter/${value.capabilityName}/${value.providerRef}` || value.credentialRef !== undefined && !isCredentialRefV1(value.credentialRef)) return undefined;
  const profileId = value.profileId;
  if (value.profileId === "offline-test-v1" && !((value.capabilityName === "search.query" && String(value.providerRef) === "builtin:llm-simulation" && value.credentialRef === undefined) || (value.capabilityName === "llm.complete" && String(value.providerRef) === "builtin:mock" && value.credentialRef === undefined))) return undefined;
  let queueBinding: QueueBindingV1 | undefined;
  if (value.queueBinding !== undefined) {
    if (!Array.isArray(profileQueueBindings) || !validateQueueBindingForProfileV1(value.queueBinding, profileId).ok || !profileQueueBindings.every((binding) => validateQueueBindingForProfileV1(binding, profileId).ok) || !profileQueueBindings.some((binding) => isQueueBinding(binding) && sameQueueBindingV1(binding, value.queueBinding as QueueBindingV1))) return undefined;
    queueBinding = Object.freeze({ ...(value.queueBinding as QueueBindingV1) });
  }
  return Object.freeze({ runtimeComponentId: value.runtimeComponentId, capabilityName: value.capabilityName, profileId: value.profileId, policyFingerprint: value.policyFingerprint, providerRef: value.providerRef, ...(value.credentialRef === undefined ? {} : { credentialRef: value.credentialRef }), ...(queueBinding === undefined ? {} : { queueBinding }) }) as unknown as BoundaryBindingV1;
}

function isBoundaryList(value: unknown, profileId: ProfileIdV1, policies: unknown, queues: unknown, allowlist: unknown, enabledWorkers: unknown): value is readonly BoundaryBindingInputV1[] {
  if (!Array.isArray(value) || !isPlainRecord(policies) || !Array.isArray(queues) || !Array.isArray(allowlist) || !Array.isArray(enabledWorkers)) return false;
  const seenTriples = new Set<string>();
  for (const binding of value) {
    if (!isPlainRecord(binding) || !hasOnlyKeys(binding, ["runtimeComponentId", "capabilityName", "profileId", "policyFingerprint", "providerRef", "credentialRef", "queueBinding"])) return false;
    if (!isCapabilityNameV1(binding.capabilityName) || binding.profileId !== profileId || !isPolicyFingerprintV1(binding.policyFingerprint)) return false;
    if (effectiveCapabilityPolicyV1({ capabilityPolicies: policies as Record<CapabilityNameV1, CapabilityPolicyV1> }, binding.capabilityName) === "deny") return false;
    const providerRef = binding.providerRef;
    const componentId = binding.runtimeComponentId;
    if (typeof componentId !== "string") return false;
    if (providerRef !== undefined && !isProviderRefV1(providerRef)) return false;
    if (binding.credentialRef !== undefined && !isCredentialRefV1(binding.credentialRef)) return false;
    const triple = `${componentId}|${binding.capabilityName}|${providerRef ?? ""}`;
    if (seenTriples.has(triple)) return false;
    seenTriples.add(triple);
    if (STATE_CAPABILITIES.has(binding.capabilityName)) {
      if (providerRef !== undefined || binding.credentialRef !== undefined || !isWorkerComponent(componentId) || !enabledWorkers.includes(componentId.slice("worker/".length)) || !checkStaticManifestComponentCapabilityV1(componentId, binding.capabilityName).allowed) return false;
    } else if (componentId.startsWith("adapter/")) {
      if (providerRef === undefined || componentId !== `adapter/${binding.capabilityName}/${providerRef}`) return false;
    } else if ((componentId.startsWith("runtime/") || componentId.startsWith("sink/")) && providerRef === undefined && binding.credentialRef === undefined) {
      if (!checkStaticManifestComponentCapabilityV1(componentId, binding.capabilityName).allowed) return false;
    } else return false;
    if (binding.credentialRef !== undefined && providerRef === undefined) return false;
    if (binding.queueBinding !== undefined && (!validateQueueBindingV1(binding.queueBinding).ok || !queues.some((queue) => isQueueBinding(queue) && sameQueueBindingV1(queue, binding.queueBinding as QueueBindingV1)))) return false;
    if (profileId === "offline-test-v1" && !((binding.capabilityName === "search.query" && String(providerRef) === "builtin:llm-simulation" && binding.credentialRef === undefined) || (binding.capabilityName === "llm.complete" && String(providerRef) === "builtin:mock" && binding.credentialRef === undefined))) return false;
    if (profileId !== "offline-test-v1" && providerRef !== undefined && !allowlist.includes(providerRef)) return false;
  }
  return profileId !== "offline-test-v1" || value.length === 2 && value.some((binding) => binding.capabilityName === "search.query" && binding.providerRef === ("builtin:llm-simulation" as ProviderRefV1)) && value.some((binding) => binding.capabilityName === "llm.complete" && binding.providerRef === ("builtin:mock" as ProviderRefV1));
}

function isInfrastructureList(value: unknown, profileId: ProfileIdV1): value is readonly InfrastructureBindingV1[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>(); const kinds = new Set<string>();
  for (const item of value) {
    if (!isInfrastructure(item) || ids.has(item.bindingId)) return false;
    ids.add(item.bindingId); kinds.add(item.kind);
  }
  return profileId !== "offline-test-v1" || value.length === 2 && kinds.size === 2 && kinds.has("postgres") && kinds.has("redis") && new Set(value.map((binding) => binding.resourceReceiptRef)).size === 2;
}
function isInfrastructure(value: unknown): value is InfrastructureBindingV1 {
  if (!isPlainRecord(value) || !hasExactKeys(value, ["kind", "bindingId", "addressHost", "addressPort", "networkMode", "resourceReceiptRef"])) return false;
  const addressPort = value.addressPort;
  if ((value.kind !== "postgres" && value.kind !== "redis" && value.kind !== "web") || typeof value.bindingId !== "string" || !/^[a-z][a-z0-9-]*$/.test(value.bindingId) || !isResourceReceiptRefV1(value.resourceReceiptRef) || typeof addressPort !== "number" || !Number.isInteger(addressPort) || addressPort < 1 || addressPort > 65535) return false;
  if (value.networkMode === "loopback") return value.addressHost === "127.0.0.1";
  return value.networkMode === "docker-internal" && typeof value.addressHost === "string" && /^[a-z][a-z0-9-]*$/.test(value.addressHost) && value.addressHost !== "localhost";
}
function isQueueList(value: unknown, profileId: ProfileIdV1, enabledWorkers: unknown): value is readonly QueueBindingV1[] {
  if (!Array.isArray(value) || !Array.isArray(enabledWorkers) || value.length === 0) return false;
  const logical = new Set<string>();
  for (const binding of value) {
    if (!validateQueueBindingForProfileV1(binding, profileId).ok || !isQueueBinding(binding) || logical.has(binding.logicalName) || !enabledWorkers.includes(binding.logicalName)) return false;
    logical.add(binding.logicalName);
  }
  return profileId !== "offline-test-v1" || value.length === 1 && isQueueBinding(value[0]) && value[0].logicalName === "geo-run";
}
function isTaskReceipt(value: unknown): value is TaskResourceReceiptV1 {
  return isPlainRecord(value) && hasExactKeys(value, ["scopeId", "infrastructureBindings", "queueBindings"]) && typeof value.scopeId === "string" && /^[a-z][a-z0-9-]*$/.test(value.scopeId) && isRawInfrastructureList(value.infrastructureBindings) && isRawQueueList(value.queueBindings);
}
function receiptMatches(profile: WorkerRuntimeProfileV1, receipt: TaskResourceReceiptV1): boolean {
  return profile.queueBindings.every((binding) => binding.scopeId === receipt.scopeId) && exactSet(profile.infrastructureConnections, receipt.infrastructureBindings as readonly InfrastructureBindingV1[], infrastructureKey) && exactSet(profile.queueBindings, receipt.queueBindings, queueKey);
}
function isRawInfrastructureList(value: unknown): value is readonly RawInfrastructureBindingV1[] {
  return Array.isArray(value) && value.length > 0 && value.every(isInfrastructure) && new Set(value.map((binding) => binding.bindingId)).size === value.length;
}
function isRawQueueList(value: unknown): value is readonly QueueBindingV1[] {
  return Array.isArray(value) && value.length > 0 && value.every((binding) => validateQueueBindingV1(binding).ok && isQueueBinding(binding)) && new Set((value as QueueBindingV1[]).map(queueKey)).size === value.length;
}
function isEnvironmentRegistry(value: unknown): value is EnvironmentRegistryV1 | undefined { return value === undefined || isPlainRecord(value) && hasExactKeys(value, ["providerRefs", "credentialRefs"]) && isUniqueRefs(value.providerRefs, isProviderRefV1) && isUniqueRefs(value.credentialRefs, isCredentialRefV1); }
function registryMatches(profile: WorkerRuntimeProfileV1, registry: EnvironmentRegistryV1 | undefined): boolean {
  if (!registry) return profile.profileId === "offline-test-v1" || profile.providerBindings.every((binding) => binding.providerRef?.startsWith("builtin:") && binding.credentialRef === undefined);
  if (profile.profileId === "offline-test-v1") return registry.providerRefs.length === 0 && registry.credentialRefs.length === 0;
  const bindings = profile.providerBindings;
  return registry.providerRefs.every((provider) => profile.providerAllowlist.includes(provider)) && registry.credentialRefs.every((credential) => bindings.some((binding) => binding.credentialRef === credential)) && bindings.every((binding) => (binding.providerRef?.startsWith("builtin:") ?? true) || registry.providerRefs.includes(binding.providerRef!)) && bindings.every((binding) => binding.credentialRef === undefined || registry.credentialRefs.includes(binding.credentialRef));
}
function isPerRunInput(value: unknown, allowedTriggers: readonly TriggerIdV1[]): boolean {
  if (value === undefined) return true;
  if (!isPlainRecord(value) || !hasOnlyKeys(value, ["runId", "stageId", "attempt", "trigger", "idempotencyKey", "input", "deadline"])) return false;
  if (value.runId !== undefined && !isRef(value.runId)) return false;
  if (value.stageId !== undefined && !isRef(value.stageId)) return false;
  if (value.idempotencyKey !== undefined && !isRef(value.idempotencyKey)) return false;
  if (value.attempt !== undefined && (typeof value.attempt !== "number" || !Number.isInteger(value.attempt) || value.attempt < 1)) return false;
  if (value.trigger !== undefined && (!isTriggerIdV1(value.trigger) || !allowedTriggers.includes(value.trigger))) return false;
  if (value.input !== undefined && !isInputRef(value.input)) return false;
  return value.deadline === undefined || isRfc3339Utc(value.deadline);
}
function isInputRef(value: unknown): value is InputRefV1 { return isPlainRecord(value) && hasExactKeys(value, ["kind", "ref"]) && typeof value.ref === "string" && (value.kind === "product-input" ? /^input:[A-Za-z0-9._-]+$/.test(value.ref) : value.kind === "artifact" ? /^artifact:[A-Za-z0-9._-]+$/.test(value.ref) : false); }
function isRfc3339Utc(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === normalized;
}
function matchesProfileSemantics(value: Record<string, unknown>, id: ProfileIdV1): boolean {
  const workers = value.enabledWorkers as readonly string[]; const triggers = value.allowedTriggers as readonly string[];
  if (id === "offline-test-v1") return sameSet(workers, ["geo-run"]) && sameSet(triggers, ["manual", "operator-replay", "retry"]) && value.providerEgress === "deny" && (value.providerAllowlist as unknown[]).length === 0 && value.evidence === "contract-only";
  if (id === "production-v1") return sameSet(workers, ["geo-run", "page-audit", "content-analysis", "report", "brand-monitor", "scheduler"]) && sameSet(triggers, ["manual", "operator-replay", "scheduled", "retry"]) && value.providerEgress === "allowlisted" && value.evidence === "required";
  return value.providerEgress === "allowlisted" && value.evidence === "required";
}
function hasExactPolicies(value: unknown, id: ProfileIdV1): boolean { return isPlainRecord(value) && hasExactKeys(value, CAPABILITY_NAMES_V1) && CAPABILITY_NAMES_V1.every((capability) => value[capability] === POLICY_BY_PROFILE[id][capability]); }
function normalizeProfile(profile: WorkerRuntimeProfileInputV1): WorkerRuntimeProfileV1 {
  const queues = profile.queueBindings.map((binding) => Object.freeze({ ...binding }));
  const infrastructure = profile.infrastructureConnections.map((binding) => Object.freeze({ ...binding }) as InfrastructureBindingV1);
  const providers = profile.providerBindings.map((binding) => Object.freeze({ ...binding, policyFingerprint: binding.policyFingerprint as PolicyFingerprintV1, providerRef: binding.providerRef as ProviderRefV1 | undefined, credentialRef: binding.credentialRef as CredentialRefV1 | undefined, queueBinding: binding.queueBinding ? Object.freeze({ ...binding.queueBinding }) : undefined }) as BoundaryBindingV1);
  return Object.freeze({ ...profile, enabledWorkers: Object.freeze([...profile.enabledWorkers]), allowedTriggers: Object.freeze([...profile.allowedTriggers]), capabilityPolicies: Object.freeze({ ...profile.capabilityPolicies }), providerAllowlist: Object.freeze([...profile.providerAllowlist]) as readonly ProviderRefV1[], infrastructureConnections: Object.freeze(infrastructure), queueBindings: Object.freeze(queues), providerBindings: Object.freeze(providers) }) as WorkerRuntimeProfileV1;
}
function exactSet<T>(left: readonly T[], right: readonly T[], key: (item: T) => string): boolean { return left.length === right.length && new Set(left.map(key)).size === left.length && new Set(right.map(key)).size === right.length && left.every((item) => new Set(right.map(key)).has(key(item))); }
function infrastructureKey(binding: InfrastructureBindingV1): string { return [binding.kind, binding.bindingId, binding.addressHost, binding.addressPort, binding.networkMode, binding.resourceReceiptRef].join("|"); }
function queueKey(binding: QueueBindingV1): string { return [binding.logicalName, binding.prefix, binding.scopeId].join("|"); }
function isQueueBinding(value: unknown): value is QueueBindingV1 { return isPlainRecord(value) && typeof value.logicalName === "string" && typeof value.prefix === "string" && typeof value.scopeId === "string"; }
function isWorkerComponent(value: unknown): value is `worker/${WorkerIdV1}` { return typeof value === "string" && /^worker\/(geo-run|page-audit|content-analysis|report|brand-monitor|scheduler|cms-publisher|distribution)$/.test(value); }
function isClosedSet(value: unknown, allowed: readonly string[]): value is readonly string[] { return Array.isArray(value) && value.every((item) => typeof item === "string" && allowed.includes(item)) && new Set(value).size === value.length; }
function isUniqueRefs<T extends string>(value: unknown, guard: (item: unknown) => item is T): value is readonly T[] { return Array.isArray(value) && value.every(guard) && new Set(value).size === value.length; }
function sameSet(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && right.every((item) => left.includes(item)); }
function isPlainRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { const actual = Object.keys(value); return actual.length === keys.length && actual.every((key) => keys.includes(key)); }
function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).every((key) => keys.includes(key)); }
function hasRequiredKeys(value: Record<string, unknown>, keys: readonly string[]): boolean { return keys.every((key) => Object.hasOwn(value, key)); }
function isCapabilityNameV1(value: unknown): value is CapabilityNameV1 { return typeof value === "string" && CAPABILITY_NAMES_V1.includes(value as CapabilityNameV1); }
function isProfileIdV1(value: unknown): value is ProfileIdV1 { return typeof value === "string" && PROFILE_IDS_V1.includes(value as ProfileIdV1); }
function isTriggerIdV1(value: unknown): value is TriggerIdV1 { return typeof value === "string" && TRIGGER_IDS_V1.includes(value as TriggerIdV1); }
function isCapabilityPolicyV1(value: unknown): value is CapabilityPolicyV1 { return value === "deny" || value === "synthetic" || value === "isolated-state" || value === "allowlisted"; }
function isProviderEgress(value: unknown): value is "deny" | "allowlisted" { return value === "deny" || value === "allowlisted"; }
function isEvidence(value: unknown): value is "contract-only" | "required" { return value === "contract-only" || value === "required"; }
function isDecision(value: unknown): value is PolicyDecisionKindV1 { return value === "allow" || value === "deny" || value === "defer"; }
function isReason(value: unknown): value is PolicyReasonCodeV1 { return typeof value === "string" && ["MOUNT_ALLOWED", "INVOKE_ALLOWED", "PROFILE_NOT_ALLOWED", "CAPABILITY_NOT_MOUNTED", "TRIGGER_NOT_ALLOWED", "NETWORK_DENIED", "APPROVAL_REQUIRED", "CREDENTIAL_REFERENCE_INVALID", "DEPENDENCY_UNHEALTHY", "IDEMPOTENCY_CONFLICT", "POLICY_VIOLATION"].includes(value); }
function isRef(value: unknown): boolean { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value); }
function isSafeReferenceId(value: unknown): boolean { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value); }
function freezeDecision(value: Record<string, unknown>): PolicyDecisionV1 { return Object.freeze({ decision: value.decision as PolicyDecisionKindV1, reasonCode: value.reasonCode as PolicyReasonCodeV1, profileId: value.profileId as ProfileIdV1, policyFingerprint: value.policyFingerprint as PolicyFingerprintV1, ...(value.approvalCheckpointRef === undefined ? {} : { approvalCheckpointRef: value.approvalCheckpointRef as ApprovalCheckpointRefV1 }) }); }
function reject(reasonCode: ProfileValidationReasonV1, field?: string): ProfileValidationResultV1 { return Object.freeze({ ok: false, exitCode: 78, reasonCode, field }); }
