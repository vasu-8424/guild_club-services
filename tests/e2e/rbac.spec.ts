import { test, expect } from "@playwright/test";
import path from "path";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

test.describe("D. Role-Based Access Control (RBAC)", () => {
  test("RBAC-01: Unauthenticated access to /super-admin, /admin, and /therapist redirects to /login", async ({ browser }) => {
    const context = await browser.newContext(); // No cookies
    const page = await context.newPage();

    const protectedPaths = [
      "/super-admin",
      "/super-admin/dashboard",
      "/admin",
      "/admin/dashboard",
      "/therapist",
      "/therapist/dashboard",
    ];

    for (const p of protectedPaths) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/login/);
    }

    await context.close();
  });

  test("RBAC-02: Admin visiting /super-admin/* is blocked", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const page = await context.newPage();

    await page.goto("/super-admin/dashboard");
    // In Stage 1, middleware redirects non-super-admins to their own role dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await context.close();
  });

  test("RBAC-03: Therapist visiting /admin/* and /super-admin/* is blocked", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();

    // 1. Visit /super-admin/dashboard
    await page.goto("/super-admin/dashboard");
    await expect(page).toHaveURL(/\/therapist\/dashboard/);

    // 2. Visit /admin/dashboard
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/therapist\/dashboard/);

    await context.close();
  });

  test("RBAC-04: Super Admin access to /admin/* follows rules defined in Stage 1", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();

    await page.goto("/admin/dashboard");
    // Under Stage 1 role partitioning, each role has exclusive dashboard namespace
    // Super admin is redirected to /super-admin/dashboard
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await context.close();
  });

  test("RBAC-05: Each role sees only its own sidebar menu items", async ({ browser }) => {
    // 1. Super Admin sidebar verification
    const superAdminContext = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const superPage = await superAdminContext.newPage();
    await superPage.goto("/super-admin/dashboard");
    const superNav = superPage.locator('[data-testid="sidebar-nav"]');
    await expect(superNav).toContainText("User Management");
    await expect(superNav).toContainText("Email Queue");
    await expect(superNav).not.toContainText("My Assigned Cases");
    await superAdminContext.close();

    // 2. Admin sidebar verification
    const adminContext = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/dashboard");
    const adminNav = adminPage.locator('[data-testid="sidebar-nav"]');
    await expect(adminNav).toContainText("Clinic Operations");
    await expect(adminNav).toContainText("Active Cases");
    await expect(adminNav).not.toContainText("System Settings");
    await adminContext.close();

    // 3. Therapist sidebar verification
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const therapistPage = await therapistContext.newPage();
    await therapistPage.goto("/therapist/dashboard");
    const therapistNav = therapistPage.locator('[data-testid="sidebar-nav"]');
    await expect(therapistNav).toContainText("Clinical Practice");
    await expect(therapistNav).toContainText("My Assigned Cases");
    await expect(therapistNav).not.toContainText("User Management");
    await therapistContext.close();
  });

  test("RBAC-06: Server-side check: call API route without session expecting 401/403", async ({ request }) => {
    // Call change-password without cookie
    const response = await request.post("/api/auth/change-password", {
      data: {
        currentPassword: "OldPassword123",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
  });

  test("RBAC-07: A tampered or expired JWT cookie is rejected", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "gcs_session",
        value: "eyJhbGciOiJIUzI1NiJ9.tampered_payload_data.invalid_signature",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    await page.goto("/super-admin/dashboard");

    // Must reject tampered token and redirect to login
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
