import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const boundary = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [123, 47],
      [124, 47],
      [124, 48],
      [123, 48],
      [123, 47],
    ],
  ],
});

const city = region("230200", "齐齐哈尔市", "PREFECTURE");
const county = region("230225", "甘南县", "COUNTY", "230200");
const township = region("230225204", "宝山乡", "TOWNSHIP", "230225");
const village = region("230225204014", "宝山村", "VILLAGE", "230225204");

test.describe("overview owned-relief interaction", () => {
  test("keeps map navigation below the KPI band at the formal acceptance viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 985, width: 1480 });
    await installOverviewFixture(page);
    await page.goto("/#/overview");

    const kpis = page.locator(".overview-command-kpis");
    const navigation = page.locator(
      ".overview-command-center > .overview-cockpit-navigation",
    );
    await expect(kpis).toBeVisible();
    await expect(navigation).toBeVisible();
    const kpiBox = await kpis.boundingBox();
    const navigationBox = await navigation.boundingBox();

    expect(kpiBox).not.toBeNull();
    expect(navigationBox).not.toBeNull();
    if (kpiBox && navigationBox) {
      expect(navigationBox.y).toBeGreaterThanOrEqual(kpiBox.y + kpiBox.height);
    }
  });

  test("raises exactly one owned administrative body at city, county, township, and village levels", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installOverviewFixture(page);
    const terrainResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/overview/command-terrain-v2.webp"),
    );
    await page.goto("/#/overview");
    const contract = page.locator("[data-cap-ownership]");

    await expect(contract).toHaveAttribute("data-style-state", "ready");
    await expect(contract.locator("canvas")).toBeVisible();
    expect((await terrainResponse).status()).toBe(200);
    expect(await canvasUniqueColors(contract)).toBeGreaterThanOrEqual(16);

    const cityButton = page.getByRole("button", {
      name: /^齐齐哈尔市，.*点击选中，双击进入下一级$/,
    });
    await cityButton.click();
    await expectOwnedSelection(contract, city.code);
    await enterSelectedRegion(page);

    const countyButton = page.getByRole("button", {
      name: /^甘南县，.*点击选中，双击进入下一级$/,
    });
    await expect(countyButton).toBeVisible();
    await countyButton.click();
    await expectOwnedSelection(contract, county.code);
    await enterSelectedRegion(page);

    const townshipButton = page.getByRole("button", {
      name: /^宝山乡，.*点击选中，双击进入下一级$/,
    });
    await expect(townshipButton).toBeVisible();
    await townshipButton.click();
    await expectOwnedSelection(contract, township.code);
    await enterSelectedRegion(page);

    const villageButton = page.getByRole("button", {
      name: /^宝山村，.*点击查看行政村详情$/,
    });
    await expect(villageButton).toBeVisible();
    await villageButton.click();
    await expectOwnedSelection(contract, village.code);

    await page.getByRole("button", { name: "关闭地区详情", exact: true }).click();
    await expect(contract).toHaveAttribute("data-ground-outlines-suppressed", "false");
    await expect(contract).toHaveAttribute("data-duplicate-interactive-top-count", "0");
  });

  test("keeps the relief renderer structurally stable through ten selection close cycles", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installOverviewFixture(page);
    let crashed = false;
    page.on("crash", () => {
      crashed = true;
    });
    const terrainResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/overview/command-terrain-v2.webp"),
    );
    await page.goto("/#/overview");
    const contract = page.locator("[data-cap-ownership]");
    await expect(contract).toHaveAttribute("data-style-state", "ready");
    await expect(contract.locator("canvas")).toBeVisible();
    expect((await terrainResponse).status()).toBe(200);
    expect(await canvasUniqueColors(contract)).toBeGreaterThanOrEqual(16);
    await contract.locator("canvas").evaluate((canvas) => {
      canvas.dataset.e2eRendererIdentity = "stable";
    });
    const cityButton = page.getByRole("button", {
      name: /^齐齐哈尔市，.*点击选中，双击进入下一级$/,
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await cityButton.click();
      await expectOwnedSelection(contract, city.code);
      await page.getByRole("button", { name: "关闭地区详情", exact: true }).click();
      await expect(contract).toHaveAttribute(
        "data-ground-outlines-suppressed",
        "false",
      );
      await expect(contract).toHaveAttribute("data-selection-overlay-layer-count", "0");
      await expect(contract).toHaveAttribute(
        "data-duplicate-interactive-top-count",
        "0",
      );
      await expect(contract).toHaveAttribute("data-style-state", "ready");
      await expect(contract.locator("canvas")).toHaveAttribute(
        "data-e2e-renderer-identity",
        "stable",
      );
    }

    expect(crashed).toBe(false);
  });
});

async function expectOwnedSelection(
  contract: ReturnType<Page["locator"]>,
  code: string,
) {
  await expect(contract).toHaveAttribute("data-selected-region", code);
  await expect(contract).toHaveAttribute("data-raised-selection-component-count", "1");
  await expect(contract).toHaveAttribute("data-selection-overlay-layer-count", "0");
  await expect(contract).toHaveAttribute("data-duplicate-interactive-top-count", "0");
  await expect(contract).toHaveAttribute("data-ground-outlines-suppressed", "true");
  await expect(contract).toHaveAttribute("data-suppressed-ground-outline-region", code);
}

async function enterSelectedRegion(page: Page) {
  const action = page.getByRole("button", {
    name: "进入样本点监测",
    exact: true,
  });
  await expect(action).toBeVisible();
  await action.click();
}

async function installOverviewFixture(page: Page) {
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/v1/business-events/stream**", (route) =>
    route.fulfill({ body: "", contentType: "text/event-stream", status: 200 }),
  );
  await page.route("**/overview/command-terrain-v2.webp", (route) =>
    route.fulfill({
      contentType: "image/webp",
      path: resolve("public/overview/command-terrain-v2.webp"),
      status: 200,
    }),
  );
  await page.route("**/api/v1/overview/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const parentCode = requestUrl.searchParams.get("parentCode");
    const regionCode = requestUrl.searchParams.get("regionCode");
    const pathname = requestUrl.pathname;
    const data = pathname.endsWith("/options")
      ? {
          products: [{ code: "CORN", label: "玉米" }],
          periods: [
            {
              code: "2026-Q3",
              endsOn: "2026-09-30",
              label: "2026年第三季度",
              startsOn: "2026-07-01",
            },
          ],
          years: [2026],
        }
      : pathname.endsWith("/map-scope")
        ? {
            boundaryGeoJson: boundary,
            componentGeometryFingerprint: "fixture-map-scope",
            name: "正式业务监测范围",
            refreshedAt: "2026-08-05T00:00:00Z",
            scopeCode: "FORMAL_BUSINESS",
            sourceLicense: "fixture",
            sourceName: "fixture",
            sourceRevision: "fixture",
          }
        : pathname.endsWith("/regions")
          ? regionsFor(parentCode)
          : pathname.endsWith("/sample-point-aggregates")
            ? []
            : pathname.endsWith("/sample-points")
              ? emptySamplePointList(regionCode)
              : pathname.endsWith("/locations")
                ? []
                : pathname.endsWith("/indicators")
                  ? []
                  : pathname.endsWith("/dashboard")
                    ? dashboardFor(regionCode)
                    : undefined;

    if (data === undefined) {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      json:
        pathname.endsWith("/indicators") || pathname.endsWith("/dashboard")
          ? { contractVersion: "overview-audit-v2", data }
          : { data },
    });
  });
}

function emptySamplePointList(regionCode: string | null) {
  return {
    categories: [],
    correctionSourceCount: 0,
    correctionSources: [],
    dataQualityIssueCount: 0,
    items: [],
    regionCode: regionCode ?? "",
    totalCount: 0,
    unresolvedSourceCount: 0,
    validCoordinateCount: 0,
  };
}

function regionsFor(parentCode: string | null) {
  if (parentCode === city.code) return [county];
  if (parentCode === county.code) return [township];
  if (parentCode === township.code) return [village];
  return [city];
}

function dashboardFor(regionCode: string | null) {
  return {
    alerts: [],
    businessTables: [],
    cultivatedAreaYoY: [],
    metrics: [],
    outputYoY: [],
    priceTrend: [],
    productStructure: [],
    regionActivity: [],
    regionPath: [],
    scope: {
      approvedRecordCount: 0,
      countyCount: regionCode === city.code ? 1 : 0,
      reportingUnitCount: 0,
      townshipCount: regionCode === county.code ? 1 : 0,
      villageCount: 1,
    },
  };
}

async function canvasUniqueColors(contract: ReturnType<Page["locator"]>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(contract).toHaveAttribute("data-style-state", "ready");
    await expect(contract.locator("canvas")).toHaveCount(1);
    try {
      const png = await contract
        .locator("canvas")
        .screenshot({ animations: "disabled" });
      return await colorsFromPng(contract, png.toString("base64"));
    } catch (error) {
      lastError = error;
      await contract.page().waitForTimeout(50);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("The owned relief canvas did not become stable.");
}

function colorsFromPng(contract: ReturnType<Page["locator"]>, base64: string) {
  return contract.evaluate(async (_node, image) => {
    const response = await fetch(`data:image/png;base64,${image}`);
    const bitmap = await createImageBitmap(await response.blob());
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 36;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return 0;
    context.drawImage(bitmap, 0, 0, sample.width, sample.height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.length; index += 16) {
      colors.add(
        `${(pixels[index] ?? 0) >> 4},${(pixels[index + 1] ?? 0) >> 4},${(pixels[index + 2] ?? 0) >> 4}`,
      );
    }
    return colors.size;
  }, base64);
}

function region(
  code: string,
  name: string,
  level: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE",
  parentCode?: string,
) {
  return {
    approvedRecordCount: 0,
    boundaryGeoJson: boundary,
    code,
    level,
    mapContextOnly: false,
    name,
    ...(parentCode ? { parentCode } : {}),
  };
}
