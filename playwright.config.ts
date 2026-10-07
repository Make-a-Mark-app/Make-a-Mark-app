import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:" + (process.env.VITE_PORT ?? "5180");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  ...(!process.env.PLAYWRIGHT_EXTERNAL && {
    webServer: {
      command: "npm run dev",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
});
