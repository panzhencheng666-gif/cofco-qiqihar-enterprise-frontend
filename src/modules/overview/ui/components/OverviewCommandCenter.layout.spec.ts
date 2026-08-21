/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Overview command center navigation layout", () => {
  it("keeps every overview presentation asset under the configured deployment base", () => {
    const presentationSources = [
      "src/modules/overview/ui/components/BoundaryMap.tsx",
      "src/modules/overview/ui/components/CesiumBoundaryMap.tsx",
      "src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx",
      "src/modules/overview/ui/components/ThreeBoundaryMap.tsx",
      "src/app/styles/global.css",
    ].map((path) => readFileSync(resolve(path), "utf8"));
    const index = readFileSync(resolve("index.html"), "utf8");

    presentationSources.forEach((source) =>
      expect(source).not.toMatch(/["'(]\/overview\//),
    );
    expect(index).toContain('href="/overview/command-terrain-v2.webp"');
  });

  it("positions map navigation from the fixed KPI band instead of an unrelated top offset", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const commandRule = css.match(/\.overview-command-center\s*\{([^}]*)\}/s)?.[1];
    const kpiRule = css.match(/\.overview-command-kpis\s*\{([^}]*)\}/s)?.[1];
    const navigationRule = css.match(
      /\.overview-command-center > \.overview-cockpit-navigation\s*\{([^}]*)\}/s,
    )?.[1];
    const metricValueRule = css.match(
      /\.overview-command-kpis strong\s*\{([^}]*)\}/s,
    )?.[1];

    expect(commandRule).toMatch(/--command-kpi-top:\s*\d+px/);
    expect(commandRule).toMatch(/--command-kpi-height:\s*\d+px/);
    expect(commandRule).toMatch(/--command-map-tools-gap:\s*\d+px/);
    expect(kpiRule).toMatch(/top:\s*var\(--command-kpi-top\)/);
    expect(kpiRule).toMatch(/height:\s*var\(--command-kpi-height\)/);
    expect(navigationRule).toMatch(
      /top:\s*calc\(\s*var\(--command-kpi-top\)\s*\+\s*var\(--command-kpi-height\)\s*\+\s*var\(--command-map-tools-gap\)\s*\)/,
    );
    expect(metricValueRule).toMatch(/white-space:\s*nowrap/);
  });

  it("centers the region selector label inside its control", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");

    expect(css).toMatch(
      /\.overview-command-center \.overview-region-browser summary,[^{]*\{[^}]*display:\s*(?:flex|grid)[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    );
  });

  it("uses a centered non-interactive data-driven ring instead of a label-offset capsule", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const source = readFileSync(
      resolve("src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx"),
      "utf8",
    );
    const markerRule = css.match(
      /\.overview-sample-point-aggregate-marker\s*\{([^}]*)\}/s,
    );

    expect(markerRule?.[1]).toMatch(/width:\s*\d+px/);
    expect(markerRule?.[1]).toMatch(/height:\s*\d+px/);
    expect(markerRule?.[1]).toMatch(/border-radius:\s*50%/);
    expect(markerRule?.[1]).not.toMatch(/conic-gradient/);
    expect(markerRule?.[1]).toMatch(/pointer-events:\s*none/);
    expect(markerRule?.[1]).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
    expect(source).toContain("samplePointAggregateRing(aggregate)");
    expect(css).not.toContain("#71b9ff");
  });

  it("keeps concrete map symbols keyboard inspectable for collision disclosure", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const iconRule = css.match(/\.overview-sample-point-map-icon\s*\{([^}]*)\}/s);

    expect(iconRule?.[1]).toMatch(/pointer-events:\s*auto/);
    expect(iconRule?.[1]).toMatch(/cursor:\s*pointer/);
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

  it("contains long metric audit metadata inside each KPI card", () => {
    const css = readFileSync(resolve("src/app/styles/global.css"), "utf8");
    const cardRule = css.match(/\.overview-command-kpis article\s*\{([^}]*)\}/s)?.[1];
    const auditRule = css.match(
      /\.overview-command-kpis article > span\s*\{([^}]*)\}/s,
    )?.[1];

    expect(cardRule).toMatch(/overflow:\s*hidden/);
    expect(auditRule).toMatch(/display:\s*block/);
    expect(auditRule).toMatch(/max-height:\s*\d+px/);
    expect(auditRule).toMatch(/overflow:\s*auto/);
    expect(auditRule).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
