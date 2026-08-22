import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "line",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:63210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.CI
          ? {
              launchOptions: {
                args: [
                  "--use-gl=angle",
                  "--use-angle=swiftshader-webgl",
                  "--enable-unsafe-swiftshader",
                ],
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 63210 --strictPort",
    url: "http://127.0.0.1:63210",
    reuseExistingServer: false,
  },
});
