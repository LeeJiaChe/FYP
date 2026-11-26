import { defineConfig, devices } from "@playwright/test";

const port = process.env.FYP_FIXTURE_APP_PORT;
if (!process.env.FYP_FIXTURE_ROOT || !port || !/^\d{4,5}$/.test(port) || Number(port) > 65535) {
  throw new Error("Launch browser tests through the disposable fixture runner");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // CI reports retain assertions and call logs. Browser traces and
    // screenshots can contain fixture sessions or encoded boarding passes.
    trace: process.env.CI ? "off" : "retain-on-failure",
    screenshot: process.env.CI ? "off" : "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.mjs/,
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 720 },
        hasTouch: true,
        isMobile: true,
      },
      testMatch: /mobile\.spec\.mjs/,
    },
  ],
  webServer: {
    command: "node --import tsx scripts/start-fixture-app.ts",
    env: { TRUST_FYP_CLIENT_IP: "true" },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
