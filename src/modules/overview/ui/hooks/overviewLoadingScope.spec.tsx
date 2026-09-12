import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import { useOverviewSampleNetworkLayers } from "./useOverviewSampleNetworkLayers";
it.each(["PREFECTURE", "COUNTY"] as const)(
  "does not fetch individual samples or metadata at %s level",
  async (level) => {
    const designPoints = vi.fn().mockResolvedValue({ items: [], totalPages: 1 });
    const definition = vi.fn();
    const snapshot = vi
      .fn()
      .mockResolvedValue({ icons: [], list: { categories: [], items: [] } });
    const repository = {
      designPoints,
      designPointDefinition: definition,
      snapshot,
      comparison: vi
        .fn()
        .mockResolvedValue({ designPoints: [], actualPoints: [], relations: [] }),
    } as unknown as OverviewSamplePointRepository;
    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        year: 2026,
        refreshSequence: 0,
        region: { code: "230221", name: "区域", level },
        repository,
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(designPoints).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
    expect(definition).not.toHaveBeenCalled();
  },
);
