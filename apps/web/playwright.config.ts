import { defineConfig, devices } from "@playwright/test"

const appPort = 3100
const trackerPort = 3101

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node e2e/mock-tracker-server.mjs",
      url: `http://127.0.0.1:${trackerPort}/__test/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `pnpm exec next dev --turbopack --hostname 127.0.0.1 --port ${appPort}`,
      url: `http://127.0.0.1:${appPort}`,
      env: {
        TRACKER_API_BASE_URL: `http://127.0.0.1:${trackerPort}/api/v1`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
