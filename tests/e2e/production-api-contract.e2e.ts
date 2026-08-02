import { expect, test, type Page } from "@playwright/test";

import { ProductionApiRoutes } from "./fixtures/production-api";

const validListPrefix =
  "/api/v1/production-records?productCode=CORN&pageKind=MONITORING&pageNumber=0&pageSize=20";

test("production list fixture fails closed against formal query contracts", async ({
  page,
}) => {
  const api = new ProductionApiRoutes();
  await api.install(page);
  await page.route("**/__fixture-contract__", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Fixture contract probe</title>",
    });
  });
  await page.goto("/__fixture-contract__");

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
