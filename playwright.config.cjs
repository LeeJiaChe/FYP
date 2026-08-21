const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.mjs/,
    },
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"] },
      testMatch: /mobile\.spec\.mjs/,
    },
  ],
  webServer: {
    command: "npm run dev -- -H 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
