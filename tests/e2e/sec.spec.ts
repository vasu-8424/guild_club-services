import { test, expect } from "@playwright/test";

test.describe("G. Security Basics", () => {
  test("SEC-01: Login form and API reject SQL-injection-style input safely", async ({ page, request }) => {
    const sqliPayloads = [
      "' OR 1=1 --",
      "admin' --",
      "' OR 'a'='a",
      "\" OR 1=1 --",
    ];

    // 1. UI form injection test
    await page.goto("/login");
    await page.evaluate(() => {
      document.querySelector("form")?.setAttribute("novalidate", "true");
    });
    for (const payload of sqliPayloads) {
      await page.fill('[data-testid="login-email-input"]', payload);
      await page.fill('[data-testid="login-password-input"]', payload);
      await page.click('[data-testid="login-submit-button"]');

      await expect(page).toHaveURL(/\/login/);
      // Either zod email validation rejects it or authentication fails with generic message
      const errorMsg = page.locator('[data-testid="login-error-message"], [data-testid="login-email-input-error"]');
      await expect(errorMsg.first()).toBeVisible();
    }

    // 2. Direct API endpoint injection test
    for (const payload of sqliPayloads) {
      const response = await request.post("/api/auth/login", {
        data: {
          email: payload,
          password: payload,
        },
      });

      expect(response.status()).toBe(400);
      const json = await response.json();
      expect(json.success).not.toBe(true);
      expect(json.error).toBeDefined();
    }
  });

  test("SEC-02: Error messages and responses never leak stack traces or database connection string", async ({ request }) => {
    // Intentionally send malformed json
    const response = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "invalid-json-structure-triggers-catch",
    });

    const bodyText = await response.text();

    // Sensitive leakage checks
    expect(bodyText).not.toContain("neon.tech");
    expect(bodyText).not.toContain("password");
    expect(bodyText).not.toContain("postgresql://");
    expect(bodyText).not.toContain("node_modules");
    expect(bodyText).not.toContain("at async");
  });

  test("SEC-03: No server secrets (DATABASE_URL, AUTH_SECRET) appear in browser bundle or page source", async ({ page }) => {
    await page.goto("/login");
    const pageSource = await page.content();

    // Check secrets
    expect(pageSource).not.toContain("npg_OWKVRNnD2z5q");
    expect(pageSource).not.toContain("aws.neon.tech");
    expect(pageSource).not.toContain("gcs_development_jwt_secret");
    expect(pageSource).not.toContain("gcs_test_auth_secret");

    // Check loaded script tags
    const scripts = await page.$$eval("script", (elements) =>
      elements.map((s) => s.innerHTML)
    );
    const combinedScripts = scripts.join(" ");

    expect(combinedScripts).not.toContain("postgresql://");
    expect(combinedScripts).not.toContain("npg_OWKVRNnD2z5q");
  });

  test("SEC-04: Security headers verification and reporting", async ({ request }) => {
    const response = await request.get("/login");
    const headers = response.headers();

    console.log("Inspected Response Headers:", {
      "x-frame-options": headers["x-frame-options"],
      "x-content-type-options": headers["x-content-type-options"],
      "referrer-policy": headers["referrer-policy"],
      "permissions-policy": headers["permissions-policy"],
      "content-security-policy": headers["content-security-policy"],
    });

    // Check configured security headers
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
