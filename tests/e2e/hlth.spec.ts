import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

test.describe("A. Project Health", () => {
  test("HLTH-01: App starts and /login loads with status 200", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Guild Club Services");
  });

  test("HLTH-02: No console errors on the login page", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    expect(consoleErrors).toEqual([]);
  });

  test("HLTH-03: Production build (npm run build) completes without errors", async () => {
    // Execute production build to verify complete compilation, TS typing, and route bundling
    const output = execSync("npm run build", {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: "pipe",
    });

    expect(output).toContain("Compiled successfully");
    expect(output).not.toContain("Error occurred prerendering page");
  });
});
