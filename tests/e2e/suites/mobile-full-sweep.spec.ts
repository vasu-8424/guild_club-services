import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const sweepScreenshotsDir = path.resolve(process.cwd(), "test-results/mobile-sweep");

if (!fs.existsSync(sweepScreenshotsDir)) {
  fs.mkdirSync(sweepScreenshotsDir, { recursive: true });
}

const sampleCaseId = "ddd36b76-4519-441d-b7aa-36f7bf2c3be6";
const sampleTherapistId = "caf461f5-078b-42e6-afbb-e78a291b541c";
const sampleAdminId = "c4864e87-652f-475d-9105-b14089a15a5f";

interface RouteConfig {
  path: string;
  role: "public" | "super_admin" | "admin" | "therapist";
  name: string;
}

const routes: RouteConfig[] = [
  // Public
  { path: "/login", role: "public", name: "auth-login" },
  { path: "/forgot-password", role: "public", name: "auth-forgot-password" },
  { path: "/reset-password", role: "public", name: "auth-reset-password" },
  { path: "/change-password", role: "public", name: "auth-change-password" },
  { path: "/offline", role: "public", name: "public-offline" },

  // Super Admin
  { path: "/super-admin/dashboard", role: "super_admin", name: "superadmin-dashboard" },
  { path: "/super-admin/admins", role: "super_admin", name: "superadmin-admins" },
  { path: "/super-admin/admins/new", role: "super_admin", name: "superadmin-admins-new" },
  { path: `/super-admin/admins/${sampleAdminId}`, role: "super_admin", name: "superadmin-admins-detail" },
  { path: "/super-admin/reports", role: "super_admin", name: "superadmin-reports" },
  { path: "/super-admin/notifications", role: "super_admin", name: "superadmin-notifications" },

  // Admin
  { path: "/admin/dashboard", role: "admin", name: "admin-dashboard" },
  { path: "/admin/branches", role: "admin", name: "admin-branches" },
  { path: "/admin/rooms", role: "admin", name: "admin-rooms" },
  { path: "/admin/cases", role: "admin", name: "admin-cases" },
  { path: "/admin/cases/new", role: "admin", name: "admin-cases-new" },
  { path: `/admin/cases/${sampleCaseId}`, role: "admin", name: "admin-cases-detail" },
  { path: `/admin/cases/${sampleCaseId}/report`, role: "admin", name: "admin-cases-report" },
  { path: "/admin/therapists", role: "admin", name: "admin-therapists" },
  { path: "/admin/therapists/new", role: "admin", name: "admin-therapists-new" },
  { path: `/admin/therapists/${sampleTherapistId}`, role: "admin", name: "admin-therapists-detail" },
  { path: `/admin/therapists/${sampleTherapistId}/edit`, role: "admin", name: "admin-therapists-edit" },

  // Therapist
  { path: "/therapist/dashboard", role: "therapist", name: "therapist-dashboard" },
  { path: "/therapist/cases", role: "therapist", name: "therapist-cases" },
  { path: "/therapist/cases/new", role: "therapist", name: "therapist-cases-new" },
  { path: `/therapist/cases/${sampleCaseId}`, role: "therapist", name: "therapist-cases-detail" },
  { path: `/therapist/cases/${sampleCaseId}/report`, role: "therapist", name: "therapist-cases-report" },
  { path: "/therapist/notes", role: "therapist", name: "therapist-notes" },
  { path: "/therapist/profile", role: "therapist", name: "therapist-profile" },

  // Shared
  { path: "/notifications", role: "admin", name: "shared-notifications" },
  { path: `/cases/${sampleCaseId}/report`, role: "admin", name: "shared-case-report" },
];

const viewports = [
  { width: 360, height: 740, label: "360px" },
  { width: 390, height: 844, label: "390px" },
  { width: 430, height: 932, label: "430px" },
];

test.describe("Full Mobile Sweep Across All 32 Routes", () => {
  for (const vp of viewports) {
    test.describe(`Viewport ${vp.label} (${vp.width}x${vp.height})`, () => {
      for (const r of routes) {
        test(`[SWEEP] ${vp.label} - ${r.name} (${r.path})`, async ({ browser }) => {
          let storageStatePath: string | undefined = undefined;
          if (r.role === "super_admin") {
            storageStatePath = path.join(authDir, "super-admin.json");
          } else if (r.role === "admin") {
            storageStatePath = path.join(authDir, "admin.json");
          } else if (r.role === "therapist") {
            storageStatePath = path.join(authDir, "therapist.json");
          }

          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: true,
            hasTouch: true,
            permissions: ["geolocation"],
            geolocation: { latitude: 17.4325, longitude: 78.4071 },
            ...(storageStatePath ? { storageState: storageStatePath } : {}),
          });

          const page = await context.newPage();
          await page.goto(r.path, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForTimeout(600);

          // 1. Assert zero horizontal overflow
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

          // 2. Capture screenshot at 360px and 390px
          if (vp.width === 360 || vp.width === 390) {
            const ssPath = path.join(sweepScreenshotsDir, `${r.name}-${vp.width}px.png`);
            await page.screenshot({ path: ssPath, fullPage: false });
          }

          await context.close();
        });
      }
    });
  }
});
