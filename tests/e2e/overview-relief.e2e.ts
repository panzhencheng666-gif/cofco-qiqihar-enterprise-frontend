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
  for (const viewport of [
    { height: 844, label: "390x844 mobile", width: 390 },
    { height: 1024, label: "768 tablet", width: 768 },
    { height: 900, label: "1440 desktop", width: 1440 },
  ]) {
    test(`keeps sample search, results, close, and bottom action reachable at ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await installOverviewFixture(page, { sampleCount: 53 });
      await page.goto("/#/overview");
      await page
        .getByRole("button", {
          name: /^齐齐哈尔市，.*点击选中，双击进入下一级$/,
        })
        .click();

      const search = page.getByLabel("搜索样本点");
      const sampleList = page.getByRole("list", { name: "样本点列表" });
      const close = page.getByRole("button", { name: "关闭地区详情" });
      const bottomAction = page.getByRole("button", {
        name: "进入齐齐哈尔市，查看区县样本",
      });
      await expect(search).toBeVisible();
      await expect(sampleList).toBeVisible();
      await expect(close).toBeVisible();
      await expect(bottomAction).toBeVisible();
      await expect(sampleList.getByRole("listitem")).toHaveCount(30);

      const [rawBottomActionBox, rawCloseBox, layout] = await Promise.all([
        bottomAction.boundingBox(),
        close.boundingBox(),
        page.evaluate(() => {
          const rect = (selector: string) => {
            const box = document
              .querySelector<HTMLElement>(selector)
              ?.getBoundingClientRect();
            return box
              ? {
                  bottom: box.bottom,
                  height: box.height,
                  left: box.left,
                  right: box.right,
                  top: box.top,
                }
              : undefined;
          };
          return {
            details: rect(".overview-command-details"),
            list: rect(".overview-sample-point-list"),
            search: rect('.overview-sample-point-list-section input[type="search"]'),
            viewport: { height: window.innerHeight, width: window.innerWidth },
          };
        }),
      ]);
      const toViewportBox = (
        box: { height: number; width: number; x: number; y: number } | null,
      ) =>
        box
          ? {
              bottom: box.y + box.height,
              height: box.height,
              left: box.x,
              right: box.x + box.width,
              top: box.y,
            }
          : undefined;
      const bottomActionBox = toViewportBox(rawBottomActionBox);
      const closeBox = toViewportBox(rawCloseBox);
      for (const box of [
        layout.details,
        layout.search,
        layout.list,
        closeBox,
        bottomActionBox,
      ]) {
        expect(box).toBeDefined();
        if (!box) continue;
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(layout.viewport.width);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.bottom).toBeLessThanOrEqual(layout.viewport.height);
        expect(box.height).toBeGreaterThan(0);
      }
    });
  }

  test("bounds 1000 results and emits one request for a rapid or composed search", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    const formalSampleQueries: string[] = [];
    await installOverviewFixture(page, {
      onFormalSampleQuery: (query) => formalSampleQueries.push(query),
      sampleCount: 1000,
    });
    await page.goto("/#/overview");
    await page
      .getByRole("button", {
        name: /^齐齐哈尔市，.*点击选中，双击进入下一级$/,
      })
      .click();
    const search = page.getByLabel("搜索样本点");
    const sampleList = page.getByRole("list", { name: "样本点列表" });
    await expect(sampleList.getByRole("listitem")).toHaveCount(30);

    const inputLatencyMs = await search.evaluate(
      (element) =>
        new Promise<number>((resolveLatency) => {
          const input = element as HTMLInputElement;
          const startedAt = performance.now();
          input.value = "高";
          input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "高" }));
          requestAnimationFrame(() => resolveLatency(performance.now() - startedAt));
        }),
    );
    expect(inputLatencyMs).toBeLessThan(100);
    await search.fill("");
    await expect.poll(() => formalSampleQueries.at(-1)).toBe("");

    const rapidStart = formalSampleQueries.length;
    await search.pressSequentially("嫩江", { delay: 20 });
    // This timeout is the behavior under test: 250ms debounce plus scheduling margin.
    await page.waitForTimeout(320);
    expect(formalSampleQueries.slice(rapidStart)).toEqual(["嫩江"]);

    await search.fill("");
    await expect.poll(() => formalSampleQueries.at(-1)).toBe("");
    const compositionStart = formalSampleQueries.length;
    await search.dispatchEvent("compositionstart", { data: "nen" });
    await search.fill("nen");
    await page.waitForTimeout(320);
    expect(formalSampleQueries).toHaveLength(compositionStart);
    await search.fill("嫩江");
    await search.dispatchEvent("compositionend", { data: "嫩江" });
    await page.waitForTimeout(320);
    expect(formalSampleQueries.slice(compositionStart)).toEqual(["嫩江"]);
  });

  test("keeps the overview canvas and key controls reachable at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await installOverviewFixture(page);
    await page.goto("/#/overview");

    await expect(page.locator(".overview-command-center")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "样本点", exact: true }),
    ).toBeVisible();
    const regionTrigger = page.getByText("选择地区", { exact: true });
    await expect(regionTrigger).toBeVisible();
    await regionTrigger.click();

    const regionList = page.locator('[aria-label="行政区列表"]');
    const regionButton = regionList.getByRole("button", { name: city.name });
    await expect(regionList).toBeVisible();
    await expect(regionButton).toBeVisible();

    const layout = await page.evaluate(() => {
      const elementHeight = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        return {
          client: element?.clientHeight ?? 0,
          scroll: element?.scrollHeight ?? 0,
        };
      };
      return {
        body: document.body.scrollWidth,
        commandCenter:
          document.querySelector<HTMLElement>(".overview-command-center")
            ?.scrollWidth ?? 0,
        header: elementHeight(".overview-command-header"),
        html: document.documentElement.scrollWidth,
        kpis: elementHeight(".overview-command-kpis"),
        viewport: window.innerWidth,
      };
    });
    expect(layout.html).toBeLessThanOrEqual(layout.viewport);
    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.commandCenter).toBeLessThanOrEqual(layout.viewport);
    expect(layout.header.scroll).toBeLessThanOrEqual(layout.header.client);
    expect(layout.kpis.scroll).toBeLessThanOrEqual(layout.kpis.client);

    for (const control of [
      page.getByRole("button", { name: "样本点", exact: true }),
      regionTrigger,
      page.locator(".overview-command-tools"),
      page.locator(".overview-cockpit-navigation"),
      regionList,
      regionButton,
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.viewport);
      }
    }
  });

  test("keeps the expanded region browser inside the 1440px desktop viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await installOverviewFixture(page);
    await page.goto("/#/overview");

    await page.getByText("选择地区", { exact: true }).click();
    const regionList = page.locator('[aria-label="行政区列表"]');
    const regionButton = regionList.getByRole("button", { name: city.name });
    await expect(regionList).toBeVisible();
    await expect(regionButton).toBeVisible();

    const { htmlWidth, viewport } = await page.evaluate(() => ({
      htmlWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(htmlWidth).toBeLessThanOrEqual(viewport);
    for (const control of [
      page.locator(".overview-command-center"),
      page.locator(".overview-command-tools"),
      page.locator(".overview-cockpit-navigation"),
      regionList,
      regionButton,
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport);
      }
    }
  });

  test("keeps map navigation below the KPI band at the formal acceptance viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 985, width: 1480 });
    await installOverviewFixture(page);
    await page.goto("/#/overview");

    const kpis = page.locator(".overview-command-kpis");
    const navigation = page.locator(
      ".overview-command-tools > .overview-cockpit-navigation",
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
    const initialRenderCount = Number(
      await contract.getAttribute("data-renderer-frame-count"),
    );
    const cityButton = page.getByRole("button", {
      name: /^齐齐哈尔市，.*点击选中，双击进入下一级$/,
    });

    const selectionCloseCycles = 10;
    for (let attempt = 0; attempt < selectionCloseCycles; attempt += 1) {
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
    const finalRenderCount = Number(
      await contract.getAttribute("data-renderer-frame-count"),
    );
    // One keyboard-style click cycle can include hover-in/out transitions on
    // both the map target and the close control, plus selection and layout.
    // Keep that bounded without rebuilding or replacing the renderer.
    expect(finalRenderCount - initialRenderCount).toBeLessThanOrEqual(
      selectionCloseCycles * 10,
    );
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
    name: /^进入.+，查看(?:区县|乡镇|行政村)样本$/,
  });
  await expect(action).toBeVisible();
  await action.click();
}

async function installOverviewFixture(
  page: Page,
  options: {
    onFormalSampleQuery?: (query: string) => void;
    sampleCount?: number;
  } = {},
) {
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
  await page.route("**/api/v1/sample-networks/*/design-comparison**", (route) =>
    route.fulfill({
      json: {
        data: {
          designCoordinateCount: 0,
          designPointCount: 0,
          designPoints: [],
          networkStatus: "PUBLISHED",
          networkYear: 2026,
          pendingVerificationDesignPointCount: 0,
          relations: [],
        },
      },
    }),
  );
  await page.route("**/api/v1/formal-sample-points**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== "/api/v1/formal-sample-points") {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      json: {
        data: formalSamplePointPage(
          requestUrl.searchParams.get("regionCode"),
          options.sampleCount ?? 0,
          requestUrl.searchParams.get("keyword") ?? "",
          Number(requestUrl.searchParams.get("page") ?? 0),
          Number(requestUrl.searchParams.get("pageSize") ?? 100),
          options.onFormalSampleQuery,
        ),
      },
    });
  });
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
          : pathname.endsWith("/sample-point-snapshot")
            ? {
                icons: [],
                list: {
                  categories: [],
                  correctionSourceCount: 0,
                  correctionSources: [],
                  dataQualityIssueCount: 0,
                  items: [],
                  regionCode: regionCode ?? city.code,
                  totalCount: 0,
                  unresolvedSourceCount: 0,
                  validCoordinateCount: 0,
                },
              }
            : pathname.endsWith("/sample-point-aggregates")
              ? []
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

function formalSamplePointPage(
  regionCode: string | null,
  count: number,
  keyword: string,
  page: number,
  pageSize: number,
  onQuery?: (query: string) => void,
) {
  if (page === 0) onQuery?.(keyword);
  const matching = Array.from({ length: count }, (_, index) => {
    const order = index + 1;
    return {
      address: `${city.name}高量地址 ${order} 号`,
      annualObservationCount: 1,
      approvalState: "APPROVED",
      businessDomain: "PRODUCTION",
      canonicalName: `高量样本 ${String(order).padStart(4, "0")}`,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      id: `94000000-0000-0000-0000-${String(order).padStart(12, "0")}`,
      kindCode: "FARMER",
      latitude: 47.3,
      locationState: "VALID",
      longitude: 123.9,
      networkMembershipCount: 1,
      objectTypeCode: "FARMER",
      objectTypeName: "农户",
      regionCode: regionCode ?? city.code,
      version: 1,
    };
  }).filter((item) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return (
      !normalizedKeyword ||
      item.canonicalName.toLowerCase().includes(normalizedKeyword) ||
      item.address.toLowerCase().includes(normalizedKeyword)
    );
  });
  const start = page * pageSize;
  return {
    items: matching.slice(start, start + pageSize),
    pageNumber: page,
    pageSize,
    totalElements: matching.length,
    totalPages: Math.ceil(matching.length / pageSize),
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
