import { expect, it } from "vitest";
import { mapAnnotationGesture } from "./mapAnnotationGesture";
it("treats a click or tiny hand movement as a point", () => {
  expect(mapAnnotationGesture([10, 10], [12, 12])).toBe("POINT");
});
it("recognizes a left drag in either direction as a rectangle", () => {
  expect(mapAnnotationGesture([10, 10], [50, 80])).toBe("RECTANGLE");
  expect(mapAnnotationGesture([50, 80], [10, 10])).toBe("RECTANGLE");
});
