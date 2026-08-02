import { expect, test, type Page } from "@playwright/test";

import { ProductionApiRoutes } from "./fixtures/production-api";

const validListPrefix =
  "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0&pageSize=20";

test("production list fixture fails closed against formal query contracts", async ({
  page,
}) => {
  const api = await contractFixture(page);

  const formalObjectTypePaths = [
    `${validListPrefix}&filter.objectTypeCode=FARMER`,
    `${validListPrefix}&filter.objectTypeCode=VILLAGE_COMMITTEE`,
    `${validListPrefix}&filter.objectTypeCode=AGRICULTURAL_TECH_STATION`,
  ];
  expect(await browserStatuses(page, formalObjectTypePaths)).toEqual([200, 200, 200]);
  expect(api.listQueries.map((query) => query.objectTypeCode)).toEqual([
    "FARMER",
    "VILLAGE_COMMITTEE",
    "AGRICULTURAL_TECH_STATION",
  ]);

  const invalidRequests = [
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=CORN&pageNumber=0&pageSize=20",
    },
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=CORN&pageKind=QUALITY&pageNumber=0&pageSize=20",
    },
    {
      method: "GET",
      path: `${validListPrefix}&filter.objectTypeCode=VILLAGE`,
    },
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=WHEAT&pageKind=MONITORING&pageNumber=0&pageSize=20",
    },
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=-1&pageSize=20",
    },
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0&pageSize=0",
    },
    {
      method: "GET",
      path: `${validListPrefix}&bogus=value`,
    },
    {
      method: "GET",
      path: `${validListPrefix}&filter.notDefined=value`,
    },
    {
      method: "GET",
      path: `${validListPrefix}&pagekind=MONITORING`,
    },
    {
      method: "GET",
      path: `${validListPrefix}&productCode=RICE`,
    },
    {
      method: "GET",
      path: `${validListPrefix}&filter.objectTypeCode=FARMER&filter.objectTypeCode=VILLAGE_COMMITTEE`,
    },
    {
      method: "GET",
      path: "/api/v1/production-records?productCode=&pageKind=MONITORING&pageNumber=0&pageSize=20",
    },
    {
      method: "GET",
      path: `${validListPrefix}&filter.objectTypeCode=%20`,
    },
    { method: "POST", path: validListPrefix },
  ] as const;

  expect(await browserStatuses(page, invalidRequests)).toEqual(
    invalidRequests.map(() => 400),
  );
  expect(api.unexpectedRequests).toEqual(
    invalidRequests.map(({ method, path }) => `${method} ${path}`),
  );
  expect(api.listQueries).toHaveLength(formalObjectTypePaths.length);
});

test("production list fixture mirrors Java integer lexical and 32-bit range rules", async ({
  page,
}) => {
  const api = await contractFixture(page);
  const validIntegerPaths = [
    validListPrefix,
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=%2B0&pageSize=%2B20&filter.objectTypeCode=FARMER",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=2147483647&pageSize=20",
  ];

  expect(await browserStatuses(page, validIntegerPaths)).toEqual([200, 200, 200]);
  expect(
    api.listQueries.map(({ pageNumber, pageSize }) => ({ pageNumber, pageSize })),
  ).toEqual([
    { pageNumber: 0, pageSize: 20 },
    { pageNumber: 0, pageSize: 20 },
    { pageNumber: 2147483647, pageSize: 20 },
  ]);

  const invalidIntegerPaths = [
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=1e3&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0&pageSize=2e1",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=2147483648&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=-2147483649&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0.5&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=NaN&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=Infinity&pageSize=20",
    "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=%200%20&pageSize=20",
  ];

  expect(await browserStatuses(page, invalidIntegerPaths)).toEqual(
    invalidIntegerPaths.map(() => 400),
  );
  expect(api.unexpectedRequests).toEqual(
    invalidIntegerPaths.map((path) => `GET ${path}`),
  );
  expect(api.listQueries).toHaveLength(validIntegerPaths.length);
});

async function contractFixture(page: Page) {
  const api = new ProductionApiRoutes();
  await api.install(page);
  await page.route("**/__fixture-contract__", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Fixture contract probe</title>",
    });
  });
  await page.goto("/__fixture-contract__");
  return api;
}

async function browserStatuses(
  page: Page,
  requests: readonly string[] | readonly { method: string; path: string }[],
) {
  return page.evaluate(async (inputs) => {
    const statuses: number[] = [];
    for (const input of inputs) {
      const request =
        typeof input === "string" ? { method: "GET", path: input } : input;
      try {
        const response = await fetch(request.path, { method: request.method });
        statuses.push(response.status);
      } catch {
        statuses.push(0);
      }
    }
    return statuses;
  }, requests);
}
