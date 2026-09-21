export interface ProjectedOperationalMarker {
  id: string;
  x: number;
  y: number;
}

export interface OperationalMarkerLayoutItem extends ProjectedOperationalMarker {
  anchorX: number;
  anchorY: number;
  displaced: boolean;
}

interface OperationalMarkerLayoutOptions {
  gapPx: number;
  viewportWidth: number;
  viewportHeight: number;
  marginPx: number;
}

export function layoutOperationalMarkers(
  markers: readonly ProjectedOperationalMarker[],
  options: OperationalMarkerLayoutOptions,
): OperationalMarkerLayoutItem[] {
  validateOptions(options);
  markers.forEach(({ id, x, y }) => {
    if (!id || !Number.isFinite(x) || !Number.isFinite(y))
      throw new Error("Operational marker ids and coordinates must be finite");
  });

  const occupied: Array<readonly [number, number]> = [];
  const minimumX = options.marginPx;
  const maximumX = options.viewportWidth - options.marginPx;
  const minimumY = options.marginPx;
  const maximumY = options.viewportHeight - options.marginPx;
  const maximumRing =
    Math.ceil(Math.max(options.viewportWidth, options.viewportHeight) / options.gapPx) +
    2;

  return [...markers]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((marker) => {
      let display: readonly [number, number] | undefined;
      for (let ring = 0; ring <= maximumRing && !display; ring += 1) {
        for (const [offsetX, offsetY] of ringOffsets(ring)) {
          const x = marker.x + offsetX * options.gapPx;
          const y = marker.y + offsetY * options.gapPx;
          if (x < minimumX || x > maximumX || y < minimumY || y > maximumY) continue;
          if (
            occupied.every(
              ([occupiedX, occupiedY]) =>
                Math.hypot(x - occupiedX, y - occupiedY) >= options.gapPx,
            )
          ) {
            display = [x, y];
            break;
          }
        }
      }
      if (!display)
        throw new Error(`No visible marker position is available for ${marker.id}`);
      occupied.push(display);
      return {
        id: marker.id,
        x: display[0],
        y: display[1],
        anchorX: marker.x,
        anchorY: marker.y,
        displaced:
          Math.abs(display[0] - marker.x) > 0.01 ||
          Math.abs(display[1] - marker.y) > 0.01,
      };
    });
}

function ringOffsets(ring: number): Array<readonly [number, number]> {
  if (ring === 0) return [[0, 0]];
  const offsets: Array<readonly [number, number]> = [];
  for (let x = -ring; x <= ring; x += 1) offsets.push([x, -ring]);
  for (let y = -ring + 1; y <= ring; y += 1) offsets.push([ring, y]);
  for (let x = ring - 1; x >= -ring; x -= 1) offsets.push([x, ring]);
  for (let y = ring - 1; y > -ring; y -= 1) offsets.push([-ring, y]);
  return offsets;
}

function validateOptions(options: OperationalMarkerLayoutOptions) {
  const values = [
    options.gapPx,
    options.viewportWidth,
    options.viewportHeight,
    options.marginPx,
  ];
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error("Operational marker layout options must be finite");
  if (
    options.gapPx <= 0 ||
    options.marginPx < 0 ||
    options.viewportWidth <= options.marginPx * 2 ||
    options.viewportHeight <= options.marginPx * 2
  )
    throw new Error("Operational marker layout viewport is unusable");
}
