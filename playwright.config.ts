import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Run sequentially for predictable DB state
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "auth",
      testDir: "./tests/e2e/suites",
      testMatch: /auth-access\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "credentials",
      testDir: "./tests/e2e/suites",
      testMatch: /credentials\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "branch-access",
      testDir: "./tests/e2e/suites",
      testMatch: /branch-access\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "rooms",
      testDir: "./tests/e2e/suites",
      testMatch: /rooms\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "therapist-board",
      testDir: "./tests/e2e/suites",
      testMatch: /therapist-board\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "cases-reports",
      testDir: "./tests/e2e/suites",
      testMatch: /cases-reports\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "notifications",
      testDir: "./tests/e2e/suites",
      testMatch: /notifications-email\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "admin-panel",
      testDir: "./tests/e2e/suites",
      testMatch: /admin-panel\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "security",
      testDir: "./tests/e2e/suites",
      testMatch: /security\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "responsive-a11y",
      testDir: "./tests/e2e/suites",
      testMatch: /responsive-a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npx tsx scripts/start-test-server.ts",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
