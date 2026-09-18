export interface OperationalSituationCatalogue {
  generatedAt: string;
  weather: readonly WeatherObservation[];
  publicEvents: readonly PublicSituationEvent[];
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

export interface OperationalSituationSource {
  code: string;
  label: string;
  status: "READY" | "STALE" | "UNAVAILABLE";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  sourceUrl: string;
  notice: string;
}
