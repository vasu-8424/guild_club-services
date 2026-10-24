/**
 * Stage 2 Test Helpers
 * Utilities for reading from the test DB, generating test data, and reusable UI actions.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as dotenv from "dotenv";
import path from "path";
import type { Page } from "@playwright/test";
import { assertTestDatabase } from "./seed-test-data";
export { assertTestDatabase };

// Load test environment
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

// Lazily initialize test DB connection
let _db: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!_db) {
    const url = assertTestDatabase();
    const sql = neon(url);
    _db = drizzle(sql);
  }
  return _db;
}

// --------------------------------------------------------------------------
// Direct DB query helpers
// --------------------------------------------------------------------------

export async function setDateTimeInput(
  locator: import("@playwright/test").Locator,
  value: string
): Promise<void> {
  try {
    await locator.fill(value);
  } catch {
    // ignore and fallback to evaluate
  }
  const current = await locator.inputValue();
  if (!current) {
    await locator.evaluate((input: HTMLInputElement, val: string) => {
      const tracker = (input as any)._valueTracker;
      if (tracker) {
        tracker.setValue("");
      }
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, val);
      } else {
        input.value = val;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  }
}

export async function rawSql(
  query: string,
  params: any[] = []
): Promise<Record<string, unknown>[]> {
  const url = assertTestDatabase();
  const sql = neon(url);
  const rows = await sql.query(query, params);
  return rows as Record<string, unknown>[];
}

export async function getEmails(
  toEmail?: string,
  template?: string
): Promise<Record<string, unknown>[]> {
  const url = assertTestDatabase();
  const sql = neon(url);

  let query = "SELECT * FROM email_queue";
  const conditions: string[] = [];
  const params: string[] = [];

  if (toEmail) {
    params.push(toEmail);
    conditions.push(`to_email = $${params.length}`);
  }
  if (template) {
    params.push(template);
    conditions.push(`template = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY created_at DESC";

  const rows = await sql.query(query, params);
  return rows as Record<string, unknown>[];
}

export async function getLatestEmail(
  toEmail: string,
  template?: string
): Promise<Record<string, unknown> | null> {
  const emails = await getEmails(toEmail, template);
  return emails[0] ?? null;
}

export async function getEvents(
  caseId?: string,
  eventType?: string
): Promise<Record<string, unknown>[]> {
  const url = assertTestDatabase();
  const sql = neon(url);

  let query = "SELECT * FROM case_events";
  const conditions: string[] = [];
  const params: string[] = [];

  if (caseId) {
    params.push(caseId);
    conditions.push(`case_id = $${params.length}`);
  }
  if (eventType) {
    params.push(eventType);
    conditions.push(`event_type = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY occurred_at DESC";

  const rows = await sql.query(query, params);
  return rows as Record<string, unknown>[];
}

export async function getCaseByNumber(caseNumber: string): Promise<Record<string, unknown> | null> {
  const url = assertTestDatabase();
  const sql = neon(url);
  const rows = await sql.query("SELECT * FROM cases WHERE case_number = $1 LIMIT 1", [caseNumber]);
  return (rows[0] as Record<string, unknown>) ?? null;
}

// --------------------------------------------------------------------------
// Credential helpers (reads temp passwords from email_queue)
// --------------------------------------------------------------------------

export async function getTempPasswordFromEmail(
  toEmail: string,
  template: "admin_credentials" | "therapist_credentials"
): Promise<string | null> {
  const email = await getLatestEmail(toEmail, template);
  if (!email) return null;
  const payload = email["payload"] as Record<string, unknown>;
  return (payload?.["tempPassword"] as string) ?? null;
}

export async function getPasswordResetToken(toEmail: string): Promise<string | null> {
  const email = await getLatestEmail(toEmail, "password_reset");
  if (!email) return null;
  const payload = email["payload"] as Record<string, unknown>;
  return (payload?.["token"] as string) ?? null;
}

// --------------------------------------------------------------------------
// Reusable UI helpers
// --------------------------------------------------------------------------

/**
 * Creates a new therapist via the Admin UI.
 * Caller must already be logged in as admin/super_admin.
 */
export async function createTherapistViaUI(
  page: Page,
  data: {
    name: string;
    email: string;
    phone: string;
    specialization: string;
    experienceYears?: number;
    maxOpenCases?: number;
  }
): Promise<void> {
  await page.goto("/admin/therapists/new");
  await page.getByTestId("therapist-name-input").fill(data.name);
  await page.getByTestId("therapist-email-input").fill(data.email);
  await page.getByTestId("therapist-phone-input").fill(data.phone);
  await page.getByTestId("therapist-specialization-input").fill(data.specialization);
  if (data.experienceYears !== undefined) {
    await page.getByTestId("therapist-experience-input").fill(String(data.experienceYears));
  }
  if (data.maxOpenCases !== undefined) {
    await page.getByTestId("therapist-max-cases-input").fill(String(data.maxOpenCases));
  }
  await page.locator('[data-testid="therapist-submit-button"], [data-testid="create-therapist-submit"]').first().click();
  const doneBtn = page.getByTestId("therapist-done-button");
  try {
    await doneBtn.waitFor({ state: "visible", timeout: 15000 });
    await doneBtn.click();
  } catch {
    // Navigated directly
  }
  await page.waitForURL(/\/admin\/therapists/, { timeout: 15000 });
}

/**
 * Creates a new case via the Admin UI.
 * Caller must already be logged in as admin/super_admin.
 */
export async function createCaseViaUI(
  page: Page,
  data: {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAge?: number;
    presentingIssues: string;
    priority?: "low" | "medium" | "high" | "urgent";
    category?: string;
  }
): Promise<string> {
  await page.goto("/admin/cases/new");
  await page.getByTestId("case-client-name-input").fill(data.clientName);
  await page.getByTestId("case-client-email-input").fill(data.clientEmail);
  await page.getByTestId("case-client-phone-input").fill(data.clientPhone);
  if (data.clientAge !== undefined) {
    await page.getByTestId("case-client-age-input").fill(String(data.clientAge));
  }
  await page.getByTestId("case-presenting-issues-input").fill(data.presentingIssues);
  if (data.priority) {
    await page.getByTestId("case-priority-select").selectOption(data.priority);
  }
  if (data.category) {
    await page.getByTestId("case-category-input").fill(data.category);
  }
  await page.locator('[data-testid="case-submit-button"], [data-testid="create-case-submit"]').first().click();

  let caseId = "";
  const numberElem = page.getByTestId("case-created-number");
  try {
    await numberElem.waitFor({ state: "visible", timeout: 15000 });
    const text = await numberElem.textContent();
    const match = text?.match(/GCS-\d{4}-\d{4}/);
    if (match) {
      const caseRec = await getCaseByNumber(match[0]);
      if (caseRec) {
        caseId = caseRec["id"] as string;
      }
    }
    const doneBtn = page.getByTestId("case-done-button");
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
    }
  } catch {
    const url = page.url();
    const idMatch = url.match(/\/admin\/cases\/([0-9a-f-]+)$/);
    if (idMatch) {
      caseId = idMatch[1];
    }
  }
  return caseId;
}

/**
 * Assigns a case to a therapist via the Admin case detail UI.
 * Caller must already be on the case detail page or it navigates there.
 */
export async function assignCaseViaUI(
  page: Page,
  caseId: string,
  therapistId: string,
  notes?: string
): Promise<void> {
  await page.goto(`/admin/cases/${caseId}`);
  await page.getByTestId("assign-therapist-select").selectOption(therapistId);
  if (notes) {
    await page.getByTestId("assign-notes-input").fill(notes);
  }
  await page.locator('[data-testid="assign-submit-button"], [data-testid="assign-case-submit"]').first().click();
  await page.waitForSelector('[data-testid="assign-success-message"], [data-testid="assignment-success"]', { timeout: 10000 }).catch(() => {
    // Some implementations show the updated status instead
  });
}

/**
 * Logs in as admin and returns after successful login.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-password-input").fill(password);
  await page.getByTestId("login-submit-button").click();
  await page.waitForURL(/\/(super-admin|admin|therapist)\/dashboard/, { timeout: 15000 });
}
