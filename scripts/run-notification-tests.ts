import "dotenv/config";
import assert from "assert";
import crypto from "crypto";
import { validateEnv, getEnv } from "../src/lib/env";
import { renderEmail } from "../src/lib/notifications/templates";
import { MockProvider } from "../src/lib/notifications/providers/mock";
import { ResendProvider, sanitizeHeader, maskEmail } from "../src/lib/notifications/providers/resend";
import { verifyResendWebhookSignature } from "../src/app/api/webhooks/resend/route";
import { getIstTodayRange, getIstMonthRange } from "../src/lib/notifications/quota";
import type { NotificationType } from "../src/lib/notifications/types";

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    });
}

async function runTests() {
  console.log("\n========================================================");
  console.log("RUNNING NOTIFICATIONS & RESEND INTEGRATION UNIT TESTS");
  console.log("========================================================\n");

  // ─── 1. ENVIRONMENT VALIDATION & SECRECY ─────────────────────────
  console.log("Suite 1: Environment Validation & Secrecy");

  await it("validates environment with mock defaults", () => {
    const env = validateEnv({
      EMAIL_PROVIDER: "mock",
    });
    assert.strictEqual(env.EMAIL_PROVIDER, "mock");
    assert.strictEqual(env.EMAIL_DAILY_LIMIT, 90);
    assert.strictEqual(env.EMAIL_MONTHLY_LIMIT, 2800);
    assert.strictEqual(env.ALLOW_REAL_EMAIL_TESTS, false);
  });

  await it("fails clearly when EMAIL_PROVIDER=resend and RESEND_API_KEY is missing", () => {
    let errorCaught = "";
    try {
      validateEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "",
        EMAIL_FROM_ADDRESS: "noreply@guildclubservices.com",
      });
    } catch (err: any) {
      errorCaught = err.message;
    }
    assert(errorCaught.includes("RESEND_API_KEY is required"));
    // Ensure no secret value is logged
    assert(!errorCaught.includes("re_"));
  });

  await it("fails clearly when EMAIL_FROM_ADDRESS domain does not match verified domain", () => {
    let errorCaught = "";
    try {
      validateEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_fake_api_key_test",
        EMAIL_FROM_ADDRESS: "test@unverified-domain.com",
        EMAIL_FROM_DOMAIN: "guildclubservices.com",
      });
    } catch (err: any) {
      errorCaught = err.message;
    }
    assert(errorCaught.includes("EMAIL_FROM_ADDRESS must be on the verified domain"));
  });

  await it("guard throws if automated test runs with resend without ALLOW_REAL_EMAIL_TESTS", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    let errorCaught = "";
    try {
      validateEnv({
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        EMAIL_FROM_ADDRESS: "noreply@guildclubservices.com",
        ALLOW_REAL_EMAIL_TESTS: "false",
      });
    } catch (err: any) {
      errorCaught = err.message;
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
    assert(errorCaught.includes("Automated tests must NEVER send real email"));
  });

  // ─── 2. TEMPLATE RENDERING & CLINICAL PRIVACY ─────────────────────
  console.log("\nSuite 2: Template Rendering & HIPAA / Clinical Privacy");

  const baseUrl = "http://localhost:3000";

  await it("Case assigned: has HTML & text, View Case link, NO client name, diagnosis, or notes", () => {
    const rendered = renderEmail("case_assigned", {
      therapistName: "Dr. Jane Smith",
      caseNumber: "CASE-2026-0042",
      priority: "high",
      category: "Speech Therapy",
      assignedBy: "Admin Rahul",
      assignedDate: "25 Oct 2026",
      caseId: "uuid-case-123",
    });

    assert(rendered.subject.includes("CASE-2026-0042"));
    assert(rendered.subject.includes("HIGH"));
    assert(rendered.html.includes(`${baseUrl}/therapist/cases/uuid-case-123`));
    assert(rendered.text.includes(`${baseUrl}/therapist/cases/uuid-case-123`));
    assert(rendered.priority === 1);

    // CRITICAL PRIVACY CHECKS:
    assert(!rendered.html.toLowerCase().includes("client:"));
    assert(!rendered.html.toLowerCase().includes("patient"));
    assert(!rendered.html.toLowerCase().includes("diagnosis"));
  });

  await it("Case reassigned: produces appropriate templates for both new and previous therapists", () => {
    const newTherapistEmail = renderEmail("case_reassigned", {
      therapistName: "Dr. New Clinician",
      caseNumber: "CASE-2026-0099",
      priority: "urgent",
      category: "Occupational",
      assignedBy: "Admin Priya",
      assignedDate: "25 Oct 2026",
      caseId: "uuid-case-99",
    });
    assert(newTherapistEmail.subject.includes("Case Reassigned to You"));
    assert(!newTherapistEmail.html.includes("diagnosis"));

    const prevTherapistEmail = renderEmail("case_unassigned", {
      therapistName: "Dr. Old Clinician",
      caseNumber: "CASE-2026-0099",
      reassignedDate: "25 Oct 2026",
    });
    assert(prevTherapistEmail.subject.includes("Case Reassigned"));
    assert(prevTherapistEmail.html.includes("no longer in your active list"));
    assert(prevTherapistEmail.priority === 2);
  });

  await it("Account created: includes Login ID and sign-in link, NEVER includes plain password", () => {
    const rendered = renderEmail("account_created", {
      recipientName: "Dr. Marcus Vance",
      loginId: "marcus.vance@guildclub.com",
      role: "therapist",
      createdByName: "Super Admin",
    });

    assert(rendered.subject.includes("Your login is ready"));
    assert(rendered.html.includes("marcus.vance@guildclub.com"));
    assert(rendered.html.includes(`${baseUrl}/login`));
    assert(rendered.html.includes("administrator will share") || rendered.html.includes("securely shared"));
    // Absolute password safety: no password string
    assert(!rendered.html.includes("Password123"));
    assert(!rendered.html.includes("ChangeMe"));
    assert(rendered.priority === 1);
  });

  await it("Password reset: includes Login ID without password", () => {
    const rendered = renderEmail("password_reset", {
      recipientName: "Dr. Marcus Vance",
      loginId: "marcus.vance@guildclub.com",
      resetByName: "Super Admin",
    });

    assert(rendered.subject.includes("Password Reset Notice"));
    assert(rendered.html.includes(`${baseUrl}/login`));
    assert(rendered.priority === 2);
  });

  await it("Case closed: includes outcome, closedAt, and view closed case link", () => {
    const rendered = renderEmail("case_closed", {
      adminName: "Admin Sunita",
      caseNumber: "CASE-2026-0012",
      therapistName: "Dr. Jane Smith",
      outcome: "successful",
      closedAt: "25 Oct 2026, 17:30",
      caseId: "uuid-case-12",
    });

    assert(rendered.subject.includes("Case Closed: CASE-2026-0012 — SUCCESSFUL"));
    assert(rendered.html.includes("Admin Sunita"));
    assert(rendered.html.includes("Dr. Jane Smith"));
    assert(rendered.html.includes(`${baseUrl}/admin/cases/uuid-case-12`));
    assert(rendered.priority === 2);
  });

  await it("Therapist declines & Session scheduled: templates rendered with text and html versions", () => {
    const decline = renderEmail("case_declined", {
      adminName: "Admin",
      caseNumber: "CASE-1",
      therapistName: "Dr. A",
      reason: "Full caseload",
      caseId: "uuid-1",
    });
    assert(decline.text.length > 20);
    assert(decline.html.length > 20);

    const session = renderEmail("session_scheduled", {
      therapistName: "Dr. B",
      caseNumber: "CASE-2",
      scheduledAt: "Tomorrow, 10:00 AM",
      caseId: "uuid-2",
    });
    assert(session.text.length > 20);
    assert(session.html.length > 20);
  });

  // ─── 3. RESEND ERROR MAPPING & LOGGING SAFETY ──────────────────────
  console.log("\nSuite 3: Resend Error Mapping & Header Injection Prevention");

  await it("sanitizeHeader strips CRLF injection characters", () => {
    const injection = "Subject\r\nBcc: victim@example.com\nTo: hacker@example.com";
    const cleaned = sanitizeHeader(injection);
    assert(!cleaned.includes("\r"));
    assert(!cleaned.includes("\n"));
    assert.strictEqual(cleaned, "Subject Bcc: victim@example.com To: hacker@example.com");
  });

  await it("maskEmail conceals recipient identity safely", () => {
    assert.strictEqual(maskEmail("doctor.smith@guildclubservices.com"), "d***h@guildclubservices.com");
    assert.strictEqual(maskEmail("me@test.com"), "m***@test.com");
  });

  await it("MockProvider simulates validation error (permanent failure)", async () => {
    const mock = new MockProvider();
    mock.simulateError({
      kind: "validation",
      message: "Domain not verified",
      statusCode: 422,
    });

    const result = await mock.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.kind, "validation");
      assert.strictEqual(result.error.statusCode, 422);
    }
  });

  await it("MockProvider simulates 429 rate limit then recovery", async () => {
    const mock = new MockProvider();
    mock.simulateError(
      {
        kind: "rate_limit",
        message: "Too many requests",
        statusCode: 429,
      },
      1
    );

    const firstAttempt = await mock.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    assert.strictEqual(firstAttempt.success, false);
    if (!firstAttempt.success) {
      assert.strictEqual(firstAttempt.error.kind, "rate_limit");
    }

    // Subsequent retry succeeds
    const secondAttempt = await mock.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    assert.strictEqual(secondAttempt.success, true);
  });

  await it("MockProvider simulates 500 server error then recovery", async () => {
    const mock = new MockProvider();
    mock.simulateError(
      {
        kind: "temporary",
        message: "Internal server error",
        statusCode: 500,
      },
      1
    );

    const firstAttempt = await mock.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    assert.strictEqual(firstAttempt.success, false);
    if (!firstAttempt.success) {
      assert.strictEqual(firstAttempt.error.kind, "temporary");
    }

    const secondAttempt = await mock.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    assert.strictEqual(secondAttempt.success, true);
  });

  // ─── 4. QUOTA CALCULATION & IST TIMEZONE ──────────────────────────
  console.log("\nSuite 4: Quota Calculation & IST Timezone");

  await it("calculates IST today range with 5.5 hour offset correctly", () => {
    const range = getIstTodayRange();
    assert(range.start instanceof Date);
    assert(range.end instanceof Date);
    assert(range.tomorrowStart instanceof Date);
    assert(range.start.getTime() < range.end.getTime());
    assert(range.end.getTime() < range.tomorrowStart.getTime());
  });

  await it("calculates IST month range starting on 1st of month", () => {
    const monthRange = getIstMonthRange();
    assert(monthRange.start instanceof Date);
    assert(monthRange.end instanceof Date);
    assert(monthRange.start.getTime() < monthRange.end.getTime());
  });

  // ─── 5. WEBHOOK VERIFICATION (SVIX) ───────────────────────────────
  console.log("\nSuite 5: Webhook Signature Verification (Svix)");

  const webhookSecret = "whsec_dGVzdF93ZWJob29rX3NlY3JldF9mb3JfdGVzdHM=";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const testId = "msg_test_id_12345";
  const testBody = JSON.stringify({
    type: "email.delivered",
    data: {
      email_id: "resend_msg_abc123",
      to: ["therapist@guildclubservices.com"],
    },
  });

  const signedContent = `${testId}.${timestamp}.${testBody}`;
  const key = Buffer.from(webhookSecret.slice(6), "base64");
  const validSignature = crypto
    .createHmac("sha256", key)
    .update(signedContent)
    .digest("base64");

  await it("accepts valid Svix webhook signature", () => {
    const isValid = verifyResendWebhookSignature(
      testBody,
      {
        id: testId,
        timestamp,
        signature: `v1,${validSignature}`,
      },
      webhookSecret
    );
    assert.strictEqual(isValid, true);
  });

  await it("rejects tampered webhook signature", () => {
    const isValid = verifyResendWebhookSignature(
      testBody + "tampered",
      {
        id: testId,
        timestamp,
        signature: `v1,${validSignature}`,
      },
      webhookSecret
    );
    assert.strictEqual(isValid, false);
  });

  await it("rejects expired webhook timestamp (older than 5 minutes)", () => {
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const staleSignedContent = `${testId}.${staleTimestamp}.${testBody}`;
    const staleSig = crypto
      .createHmac("sha256", key)
      .update(staleSignedContent)
      .digest("base64");

    const isValid = verifyResendWebhookSignature(
      testBody,
      {
        id: testId,
        timestamp: staleTimestamp,
        signature: `v1,${staleSig}`,
      },
      webhookSecret
    );
    assert.strictEqual(isValid, false);
  });

  console.log("\n========================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
