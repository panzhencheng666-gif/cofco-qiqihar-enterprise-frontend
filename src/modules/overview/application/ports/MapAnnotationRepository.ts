export type MapAnnotationType = "POINT" | "RECTANGLE";

export interface MapAnnotation {
  type: MapAnnotationType;
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
  regionCode?: string | undefined;
  administrativeLevel?: "CITY" | "COUNTY" | "TOWNSHIP" | "VILLAGE" | undefined;
  version: number;
  updatedAt: string;
}

export interface SaveMapAnnotation {
  type: MapAnnotationType;
  minLongitude: number;
  minLatitude: number;
  maxLongitude?: number | null;
  maxLatitude?: number | null;
  regionCode?: string | undefined;
  administrativeLevel?: "CITY" | "COUNTY" | "TOWNSHIP" | "VILLAGE" | undefined;
}

export interface MapAnnotationRepository {
  current(): Promise<MapAnnotation | undefined>;
  save(annotation: SaveMapAnnotation): Promise<MapAnnotation>;
  delete(): Promise<boolean>;
}
