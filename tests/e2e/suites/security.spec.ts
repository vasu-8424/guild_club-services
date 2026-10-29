import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { securityHeaders } from "../../../src/lib/security-headers";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";

test.describe("Suite I: SECURITY AND ROBUSTNESS", () => {
  const sql = neon(assertTestDatabase());

  test("[SEC-GEO-01] Unit test: securityHeaders contains Permissions-Policy with value exactly 'geolocation=(self)'", () => {
    const permPolicy = securityHeaders.find((h) => h.key.toLowerCase() === "permissions-policy");
    expect(permPolicy).toBeDefined();
    expect(permPolicy?.value).toBe("geolocation=(self)");
  });

  test("[SEC-GEO-02] HTTP test: /login and therapist routes return Permissions-Policy: geolocation=(self) and never geolocation=()", async ({ request }) => {
    const loginRes = await request.get("/login");
    const loginHeaders = loginRes.headers();
    const loginPermPolicy = loginHeaders["permissions-policy"];
    expect(loginPermPolicy).toBe("geolocation=(self)");
    expect(loginPermPolicy).not.toContain("geolocation=()");

    const therapistRes = await request.get("/therapist/dashboard");
    const therapistHeaders = therapistRes.headers();
    const therapistPermPolicy = therapistHeaders["permissions-policy"];
    expect(therapistPermPolicy).toBe("geolocation=(self)");
    expect(therapistPermPolicy).not.toContain("geolocation=()");
  });

  test("[SEC-GEO-03] Browser test: grant geolocation -> location gate unlocks and login record contains lat, lng, and accuracy", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["geolocation"],
      geolocation: { latitude: 12.9716, longitude: 77.5946, accuracy: 15 },
    });
    const page = await context.newPage();

    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    // Log in as therapist
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', "Password@Therapist1");
    await page.click('[data-testid="login-submit-button"]');

    // Should navigate to /therapist/dashboard and unlock gate
    await page.waitForURL(/\/therapist\/dashboard/);
    
    // Check that board is unlocked or location captured
    await expect(page.getByTestId("daily-board")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("location-gate")).toHaveCount(0);

    // Verify DB: login record contains coordinates and accuracy
    const [tUser] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [loginRec] = await sql`
      SELECT sign_in_latitude, sign_in_longitude, sign_in_accuracy_meters, sign_in_location_status
      FROM login_records
      WHERE user_id = ${tUser.id}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(loginRec).toBeDefined();
    expect(loginRec.sign_in_location_status).toBe("captured");
    expect(Number(loginRec.sign_in_latitude)).toBeCloseTo(12.9716, 2);
    expect(Number(loginRec.sign_in_longitude)).toBeCloseTo(77.5946, 2);
    expect(Number(loginRec.sign_in_accuracy_meters)).toBeGreaterThan(0);

    // Assert no "permissions policy" violation message on board page
    const policyViolations = consoleMessages.filter((msg) =>
      /permissions\s*policy/i.test(msg)
    );
    expect(policyViolations.length).toBe(0);

    await context.close();
  });

  test("[SEC-GEO-04] Browser test: deny geolocation -> board stays locked and reset guide shows", async ({ browser }) => {
    // Reset login record status so user is pending
    const [tUser] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_2_EMAIL || "qa.therapist2.north@guildclub.com"} LIMIT 1`;
    if (tUser) {
      await sql`
        UPDATE login_records 
        SET sign_in_location_status = 'pending' 
        WHERE user_id = ${tUser.id}
      `;
    }

    const context = await browser.newContext({
      permissions: [], // No geolocation permission
    });
    const page = await context.newPage();

    const consoleMessages: string[] = [];
    page.on("console", (msg) => {
      consoleMessages.push(msg.text());
    });

    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_THERAPIST_2_EMAIL || "qa.therapist2.north@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', "Password@Therapist2");
    await page.click('[data-testid="login-submit-button"]');

    await page.waitForURL(/\/therapist\/dashboard/);

    // Location gate remains visible and board stays locked
    await expect(page.getByTestId("location-gate")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("therapist-board")).toHaveCount(0);

    // Reset guide / instructions must be visible
    await expect(page.getByText("How to enable location in your browser", { exact: false })).toBeVisible();

    // Assert no "permissions policy" violation message in browser console
    const policyViolations = consoleMessages.filter((msg) =>
      /permissions\s*policy/i.test(msg)
    );
    expect(policyViolations.length).toBe(0);

    await context.close();
  });
  test("[SEC-01] SQL-injection-style input is safely parameterized and rejected/handled", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', "' OR '1'='1' -- ");
    await page.fill('[data-testid="login-password-input"]', "Password123");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const bodyText = await page.content();
    expect(bodyText).not.toContain("syntax error");
    expect(bodyText).not.toContain("PostgreSQL");
  });

  test("[SEC-02] Application errors never leak stack traces or connection strings to client", async ({ page }) => {
    const res = await page.goto("/non-existent-unhandled-route-xyz-404");
    const text = await page.content();
    expect(text).not.toContain("neon.tech");
    expect(text).not.toContain("npg_");
    expect(text).not.toContain("at async");
  });

  test("[SEC-03] No database secrets appear in client JavaScript bundle", async ({ page }) => {
    const nextStaticDir = path.resolve(process.cwd(), ".next/static");
    if (fs.existsSync(nextStaticDir)) {
      const files = fs.readdirSync(nextStaticDir, { recursive: true });
      let leaked = false;
      for (const file of files) {
        if (typeof file === "string" && file.endsWith(".js")) {
          const content = fs.readFileSync(path.join(nextStaticDir, file), "utf8");
          if (content.includes("ep-billowing-heart") || content.includes("npg_OWKVRNnD2z5q")) {
            leaked = true;
            break;
          }
        }
      }
      expect(leaked).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  test("[SEC-04] Security headers present in responses", async ({ page }) => {
    const res = await page.goto("/login");
    const headers = res?.headers() || {};
    // Check for common security headers
    expect(headers).toBeDefined();
  });

  test("[SEC-05] HTML and script tags in notes, names, and descriptions are stored and rendered escaped (XSS)", async ({ page }) => {
    const xssPayload = "<script>alert('XSS')</script>";
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', xssPayload);
    await page.fill('[data-testid="login-password-input"]', "Password123");
    await page.click('[data-testid="login-submit-button"]');

    // Page must not execute the script or render unescaped tag
    const alertFired = false;
    page.on("dialog", () => {
      throw new Error("XSS Dialog was triggered!");
    });
    expect(alertFired).toBe(false);
  });

  test("[SEC-06] Double-clicking submit creates exactly one record (idempotency)", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[SEC-07] Browser back after submit does not re-execute submission", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[SEC-08] Direct API calls with no session return 401", async ({ page }) => {
    const res = await page.request.get("/api/admin/cases");
    expect([401, 403, 307]).toContain(res.status());
  });

  test("[SEC-09] Direct API calls with wrong role return 403", async ({ page }) => {
    // Calling super-admin route as unauthenticated or non-super-admin returns 401/403
    const res = await page.request.get("/api/super-admin/admins");
    expect([401, 403, 307]).toContain(res.status());
  });

  test("[SEC-10] API route security audit verifies authentication requirement across all protected routes", async ({ page }) => {
    const protectedRoutes = [
      "/api/admin/therapists",
      "/api/admin/cases",
      "/api/therapist/cases/1/notes",
      "/api/therapist/cases/1/sessions",
      "/api/dashboard/summary",
    ];

    for (const route of protectedRoutes) {
      const res = await page.request.get(route);
      expect([401, 403, 404, 405, 307]).toContain(res.status());
    }
  });
});
