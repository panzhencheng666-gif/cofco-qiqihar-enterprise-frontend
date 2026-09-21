export const REMOTE_ENHANCEMENT_IDS = [
  "satellite",
  "terrain-dem",
  "hillshade-dem",
  "openmaptiles",
] as const;

export type RemoteEnhancementId = (typeof REMOTE_ENHANCEMENT_IDS)[number];

export interface RemoteEnhancementStatus {
  failed: ReadonlySet<RemoteEnhancementId>;
  pending: ReadonlySet<RemoteEnhancementId>;
}

export type RemoteEnhancementEvent = {
  id: RemoteEnhancementId;
  type: "FAILED" | "READY";
};

export function isRemoteEnhancementId(
  value: string | undefined,
): value is RemoteEnhancementId {
  return (
    typeof value === "string" &&
    (REMOTE_ENHANCEMENT_IDS as readonly string[]).includes(value)
  );
}

export function enhancementTimeoutMs(id: RemoteEnhancementId) {
  return id === "terrain-dem" || id === "hillshade-dem" ? 6_000 : 8_000;
}

export function nextEnhancementStatus(
  current: RemoteEnhancementStatus,
  event: RemoteEnhancementEvent,
): RemoteEnhancementStatus {
  const failed = new Set(current.failed);
  const pending = new Set(current.pending);
  pending.delete(event.id);
  if (event.type === "FAILED") failed.add(event.id);
  else failed.delete(event.id);
  return { failed, pending };
}
