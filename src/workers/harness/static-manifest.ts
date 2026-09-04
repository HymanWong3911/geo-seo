import type { CapabilityNameV1, RuntimeComponentIdV1, WorkerIdV1 } from "./runtime-profile";

/** Pre-import data only; this is neither a health check nor an import factory. */
export const STATIC_WORKER_CAPABILITY_MANIFEST_V1: Readonly<Record<WorkerIdV1, readonly CapabilityNameV1[]>> = freezeManifest({
  "geo-run": ["search.query", "llm.complete", "product-state.read", "product-state.write", "notification.send"],
  "content-analysis": ["llm.complete", "web.crawl", "product-state.read", "product-state.write", "artifact.write"],
  "page-audit": ["web.crawl", "llm.complete", "product-state.read", "product-state.write", "artifact.write"],
  report: ["product-state.read", "artifact.write"], "brand-monitor": ["search.query", "product-state.read", "product-state.write"],
  scheduler: ["schedule.register"], "cms-publisher": ["cms.publish"], distribution: ["content.distribute"],
});
export const STATIC_RUNTIME_COMPONENT_CAPABILITY_MANIFEST_V1: Readonly<Record<"runtime/alert-retention", readonly CapabilityNameV1[]>> = freezeManifest({ "runtime/alert-retention": ["retention.execute"] });
export const STATIC_COMPONENT_CAPABILITY_MANIFEST_V1: Readonly<Record<string, readonly CapabilityNameV1[]>> = freezeManifest(Object.fromEntries([
  ...Object.entries(STATIC_WORKER_CAPABILITY_MANIFEST_V1).map(([workerId, capabilities]) => [`worker/${workerId}`, capabilities]),
  ...Object.entries(STATIC_RUNTIME_COMPONENT_CAPABILITY_MANIFEST_V1),
]));
export type StaticManifestDecisionV1 = Readonly<{ allowed: boolean; reasonCode: "MOUNT_ALLOWED" | "CAPABILITY_NOT_MOUNTED" }>;
export function workerComponentIdV1(workerId: WorkerIdV1): RuntimeComponentIdV1 { return `worker/${workerId}`; }
export function checkStaticManifestCapabilityV1(workerId: unknown, capabilityName: unknown): StaticManifestDecisionV1 { return checkStaticManifestComponentCapabilityV1(typeof workerId === "string" ? `worker/${workerId}` : workerId, capabilityName); }
export function checkStaticManifestComponentCapabilityV1(componentId: unknown, capabilityName: unknown): StaticManifestDecisionV1 {
  if (typeof componentId !== "string" || typeof capabilityName !== "string" || !Object.hasOwn(STATIC_COMPONENT_CAPABILITY_MANIFEST_V1, componentId)) return { allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" };
  const capabilities = STATIC_COMPONENT_CAPABILITY_MANIFEST_V1[componentId];
  return capabilities.includes(capabilityName as CapabilityNameV1) ? { allowed: true, reasonCode: "MOUNT_ALLOWED" } : { allowed: false, reasonCode: "CAPABILITY_NOT_MOUNTED" };
}
function freezeManifest<T extends Record<string, readonly CapabilityNameV1[]>>(manifest: T): Readonly<T> {
  const frozen = Object.create(null) as Record<string, readonly CapabilityNameV1[]>;
  for (const [component, capabilities] of Object.entries(manifest)) frozen[component] = Object.freeze([...capabilities]);
  return Object.freeze(frozen) as Readonly<T>;
}
