import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

/* global document */

const DEFAULT_URL = "http://127.0.0.1:63202/overview-monitoring/?embed=1#/overview";

function requiredOutput(value, label) {
  if (!value) throw new Error(`${label} output path is required`);
  return path.resolve(value);
}

function loopbackPreviewUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("preview URL must use numeric loopback HTTP");
  }
  return url.toString();
}

async function ensureParent(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

async function waitForBlenderState(page, selector, state) {
  await page.waitForFunction(
    ({ selector: targetSelector, state: targetState }) =>
      document.querySelector(targetSelector)?.getAttribute("data-blender-state") ===
      targetState,
    { selector, state },
    { timeout: 60_000 },
  );
}

async function screenshot(page, file) {
  await ensureParent(file);
  await page.screenshot({ fullPage: true, path: file });
}

const [rootArgument, sampleArgument, situationArgument] = process.argv.slice(2);
const outputs = {
  publicSituation: requiredOutput(situationArgument, "public-situation"),
  sampleDrilldown: requiredOutput(sampleArgument, "sample-drilldown"),
  sampleRoot: requiredOutput(rootArgument, "sample-root"),
};
const previewUrl = loopbackPreviewUrl(
  process.env["OVERVIEW_PREVIEW_URL"] ?? DEFAULT_URL,
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { height: 1080, width: 1920 } });
const browserErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});
page.on("pageerror", (error) => browserErrors.push(error.message));

try {
  await page.goto(previewUrl, { timeout: 60_000, waitUntil: "networkidle" });
  const sampleSelector = ".overview-terrain-relief-map";
  await waitForBlenderState(page, sampleSelector, "ready");
  const sampleRoot = await page.locator(sampleSelector).evaluate((element) => ({
    blenderEnabled: element.getAttribute("data-blender-enabled"),
    blenderState: element.getAttribute("data-blender-state"),
    regionLabels: [...document.querySelectorAll(".overview-relief-label")].map(
      (label) => label.getAttribute("aria-label"),
    ),
  }));
  if (sampleRoot.regionLabels.length !== 4) {
    throw new Error(
      `expected four root sample regions, received ${sampleRoot.regionLabels.length}`,
    );
  }
  await screenshot(page, outputs.sampleRoot);

  const enhancement = page.getByRole("button", { name: "Blender 立体增强" });
  await enhancement.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".overview-terrain-relief-map")
        ?.getAttribute("data-blender-enabled") === "false",
  );
  await enhancement.click();

  for (const code of ["230200", "230281", "230281101"]) {
    await page.locator(`.overview-relief-label[data-region-code="${code}"]`).dblclick();
    await page.waitForTimeout(1_200);
  }
  await waitForBlenderState(page, sampleSelector, "out-of-scope");
  await page.waitForFunction(
    () => document.querySelectorAll(".overview-sample-point-map-icon").length > 0,
    undefined,
    { timeout: 60_000 },
  );
  const sampleDrilldown = await page.locator(sampleSelector).evaluate((element) => ({
    blenderState: element.getAttribute("data-blender-state"),
    exactSampleMarkers: [
      ...document.querySelectorAll(".overview-sample-point-map-icon"),
    ]
      .map((marker) => ({
        latitude: marker.getAttribute("data-anchor-latitude"),
        layerType: marker.getAttribute("data-layer-type"),
        longitude: marker.getAttribute("data-anchor-longitude"),
      }))
      .filter(({ latitude, longitude }) => latitude && longitude),
  }));
  await screenshot(page, outputs.sampleDrilldown);

  await page.goto(previewUrl, { timeout: 60_000, waitUntil: "networkidle" });
  await page.getByRole("button", { name: "公开态势" }).click();
  const situationSelector = '[data-renderer="maplibre-four-region-terrain"]';
  await waitForBlenderState(page, situationSelector, "ready");
  const publicSituation = await page.locator(situationSelector).evaluate((element) => ({
    blenderEnabled: element.getAttribute("data-blender-enabled"),
    blenderState: element.getAttribute("data-blender-state"),
    canvasCount: element.querySelectorAll("canvas").length,
  }));
  await screenshot(page, outputs.publicSituation);

  if (browserErrors.length) {
    throw new Error(`browser errors: ${browserErrors.join(" | ")}`);
  }
  console.log(
    JSON.stringify(
      {
        browserErrors,
        outputs,
        previewUrl,
        publicSituation,
        sampleDrilldown,
        sampleRoot,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
