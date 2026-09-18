export interface OperationalSituationCatalogue {
  generatedAt: string;
  weather: readonly WeatherObservation[];
  publicEvents: readonly PublicSituationEvent[];
  policyEvents: readonly PolicySituationEvent[];
  sources: readonly OperationalSituationSource[];
}

export interface WeatherObservation {
  rootRegionCode: string;
  regionName: string;
  longitude: number;
  latitude: number;
  observedAt: string;
  meanTemperatureC: number | null;
  precipitationMm: number | null;
  soilMoisturePercent: number | null;
  risk: string;
  assessment: string;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface PublicSituationEvent {
  eventId: string;
  title: string;
  description: string | null;
  categoryCode: string;
  categoryLabel: string;
  longitude: number;
  latitude: number;
  observedAt: string;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  eventUrl: string;
  evidenceUrl: string | null;
  fetchedAt: string;
}

export interface PolicySituationEvent {
  sourceId: string;
  rootRegionCode: string;
  title: string;
  summary: string;
  publishedOn: string | null;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string | null;
}

export interface OperationalSituationSource {
  code: string;
  label: string;
  status: "READY" | "STALE" | "UNAVAILABLE";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  sourceUrl: string;
  notice: string;
}
