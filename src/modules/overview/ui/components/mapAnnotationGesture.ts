export function mapAnnotationGesture(
  start: readonly [number, number],
  end: readonly [number, number],
) {
  return Math.hypot(end[0] - start[0], end[1] - start[1]) >= 6 ? "RECTANGLE" : "POINT";
}
