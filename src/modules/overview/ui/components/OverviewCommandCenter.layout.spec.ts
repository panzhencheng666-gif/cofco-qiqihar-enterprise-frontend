/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Overview command center navigation layout", () => {
  it("centers the region selector label inside its control", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");

    expect(css).toMatch(
      /\.overview-command-center \.overview-region-browser summary,[^{]*\{[^}]*display:\s*(?:flex|grid)[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    );
  });

  it("uses a centered non-interactive ring instead of a label-offset capsule", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const markerRule = css.match(
      /\.overview-sample-point-aggregate-marker\s*\{([^}]*)\}/s,
    );

    expect(markerRule?.[1]).toMatch(/width:\s*\d+px/);
    expect(markerRule?.[1]).toMatch(/height:\s*\d+px/);
    expect(markerRule?.[1]).toMatch(/border-radius:\s*50%/);
    expect(markerRule?.[1]).toMatch(/conic-gradient/);
    expect(markerRule?.[1]).toMatch(/pointer-events:\s*none/);
    expect(markerRule?.[1]).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
  });

  it("keeps concrete map symbols visually present but non-interactive", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const iconRule = css.match(/\.overview-sample-point-map-icon\s*\{([^}]*)\}/s);

    expect(iconRule?.[1]).toMatch(/pointer-events:\s*none/);
    expect(iconRule?.[1]).toMatch(/cursor:\s*default/);
  });

  it("does not let a renderer rebuild cancel the independently owned details-frame transition", () => {
    const source = readFileSync(
      resolve("src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx"),
      "utf8",
    );
    const rendererCleanup = source.match(
      /renderer\.domElement\.removeEventListener\("click"[\s\S]*?resources\.forEach/,
    )?.[0];

    expect(rendererCleanup).toBeDefined();
    expect(rendererCleanup).not.toContain("cancelLayoutTimer()");
  });

  it("keeps hover and aggregate label separation inside the geometry planner", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const hoverRule = css.match(/\.overview-relief-label:hover\s*\{([^}]*)\}/s)?.[1];
    const aggregateRule = css.match(
      /\.overview-relief-label\.has-sample-point-aggregate\s*\{([^}]*)\}/s,
    )?.[1];

    expect(hoverRule).not.toMatch(/transform:/);
    expect(aggregateRule).not.toMatch(/transform:/);
  });
});
