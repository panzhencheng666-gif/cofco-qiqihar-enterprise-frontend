import { chromium } from "@playwright/test";

const outputPath = globalThis.process.argv[2] ?? "/tmp/qiqihar-overview-golden.png";
const baseUrl =
  globalThis.process.env.OVERVIEW_BASE_URL ??
  "http://127.0.0.1:63182/overview-monitoring/?embed=1#/overview";
const productCode = globalThis.process.env.OVERVIEW_PRODUCT_CODE;
const scopeCode = globalThis.process.env.OVERVIEW_SCOPE_CODE ?? "230200";
const viewport = {
  height: Number(globalThis.process.env.OVERVIEW_VIEWPORT_HEIGHT ?? 1080),
  width: Number(globalThis.process.env.OVERVIEW_VIEWPORT_WIDTH ?? 1920),
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport,
  });
  const terrainResponse = page.waitForResponse((response) =>
    new globalThis.URL(response.url()).pathname.endsWith(
      "/overview/command-terrain-v2.webp",
    ),
  );
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const scope = page.getByLabel("区域范围");
  await scope.waitFor({ state: "visible" });
  await scope.selectOption(scopeCode);
  if (productCode) await page.getByLabel("产品").selectOption(productCode);

  const scene = page.locator('[data-overview-scene="viewer-created"]');
  await scene.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const element = globalThis.document.querySelector(
      '[data-overview-scene="viewer-created"]',
    );
    return (
      element?.getAttribute("data-style-state") === "ready" &&
      Boolean(element.querySelector("canvas"))
    );
  });
  const terrain = await terrainResponse;
  if (terrain.status() !== 200) {
    throw new Error(`Terrain resource returned ${terrain.status()}`);
  }

  const canvasPng = await scene.locator("canvas").screenshot({
    animations: "disabled",
  });
  const uniqueColorCount = await page.evaluate(async (base64) => {
    const response = await globalThis.fetch(`data:image/png;base64,${base64}`);
    const bitmap = await globalThis.createImageBitmap(await response.blob());
    const sample = globalThis.document.createElement("canvas");
    sample.width = 64;
    sample.height = 36;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return 0;
    context.drawImage(bitmap, 0, 0, sample.width, sample.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 16) {
      colors.add(
        `${pixels[index] >> 4},${pixels[index + 1] >> 4},${pixels[index + 2] >> 4}`,
      );
    }
    return colors.size;
  }, canvasPng.toString("base64"));
  if (uniqueColorCount < 16) {
    throw new Error(
      `Terrain canvas is visually monochrome (${uniqueColorCount} sampled colors)`,
    );
  }

  await page.getByRole("button", { name: /^拜泉县，/ }).click();
  await page
    .getByRole("complementary", { name: "所选地区样本点详情" })
    .waitFor({ state: "visible" });
  await page.screenshot({ animations: "disabled", path: outputPath });
  globalThis.console.log(
    JSON.stringify({
      outputPath,
      productCode: await page.getByLabel("产品").inputValue(),
      scopeCode: await scope.inputValue(),
      styleState: await scene.getAttribute("data-style-state"),
      terrainStatus: terrain.status(),
      uniqueColorCount,
    }),
  );
} finally {
  await browser.close();
}
