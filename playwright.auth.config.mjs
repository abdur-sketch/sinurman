import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["spmb-authenticated.spec.mjs", "spmb-pin-authenticated.spec.mjs"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-auth-report", open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
