export interface OperationalSituationCatalogue {
  generatedAt: string;
  weather: readonly WeatherObservation[];
  publicEvents: readonly PublicSituationEvent[];
  policyEvents: readonly PolicySituationEvent[];
  logisticsFlows: readonly LogisticsFlow[];
  inventories: readonly InventorySnapshot[];
  sources: readonly OperationalSituationSource[];
}

export interface LogisticsFlow {
  eventId: string;
  productCode: string;
  direction: string;
  originRegionCode: string;
  originRegionName: string;
  originLongitude: number;
  originLatitude: number;
  destinationRegionCode: string;
  destinationRegionName: string;
  destinationLongitude: number;
  destinationLatitude: number;
  volumeTonnes: number | null;
  occurredAt: string;
  transportMode: string;
}

export interface InventorySnapshot {
  regionCode: string;
  regionName: string;
  productCode: string;
  longitude: number;
  latitude: number;
  inventoryTonnes: number;
  sourceCount: number;
  observedAt: string;
}

export interface WeatherObservation {
  rootRegionCode: string;
  regionCode?: string;
  regionName: string;
  longitude: number;
  latitude: number;
  observedAt: string;
  meanTemperatureC: number | null;
  precipitationMm: number | null;
  soilMoisturePercent: number | null;
  weatherCode?: number | null;
  windSpeedKph?: number | null;
  windDirectionDegrees?: number | null;
  cloudCoverPercent?: number | null;
  observationPrecision?: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "INHERITED_TOWNSHIP";
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
