import type { OverviewRegion } from "../../domain/overview";

export type PublicSituationProjection = "globe" | "mercator";

export function publicSituationProjection(
  level: OverviewRegion["level"] | undefined,
): PublicSituationProjection {
  return level === "PREFECTURE" || level === undefined ? "globe" : "mercator";
}

export function publicSituationPitch(
  level: OverviewRegion["level"] | undefined,
  viewAngle: number,
) {
  const requestedPitch = 90 - viewAngle;
  return publicSituationProjection(level) === "globe"
    ? Math.min(25, requestedPitch)
    : requestedPitch;
}

export function publicSituationAtmosphere(
  level: OverviewRegion["level"] | undefined,
) {
  return publicSituationProjection(level) === "globe" ? 0.82 : 0.18;
}
