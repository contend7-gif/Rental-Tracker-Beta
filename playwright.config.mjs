import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  outputDir: "output/playwright/test-results",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
