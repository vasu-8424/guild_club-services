import "dotenv/config";
import { getEnv } from "../src/lib/env";
import { ResendProvider } from "../src/lib/notifications/providers/resend";
import { renderEmail } from "../src/lib/notifications/templates";
import { getEmailQuotaUsage } from "../src/lib/notifications/quota";
import { db } from "../src/db";
import { emailQueue } from "../src/db/schema";

async function main() {
  const args = process.argv.slice(2);
  const recipient = args[0]?.trim();

  console.log("=== Guild Club Services: Real-Send Email Verification ===");

  if (!recipient || !recipient.includes("@") || recipient.length < 5) {
    console.error("\nError: Recipient email address is required.");
    console.error("Usage: npm run email:test -- you@example.com\n");
    process.exit(1);
  }

  const env = getEnv();

  if (env.EMAIL_PROVIDER !== "resend") {
    console.error(
      `\nError: Refusing to send real email. EMAIL_PROVIDER is '${env.EMAIL_PROVIDER}', not 'resend'.`
    );
    console.error("Set EMAIL_PROVIDER=resend in .env to enable real sending.\n");
    process.exit(1);
  }

  // Quota check
  const quota = await getEmailQuotaUsage();
  console.log(`Current Daily Quota: ${quota.todaySent} / ${quota.dailyLimit} sent today (IST)`);
  console.log(`Current Monthly Quota: ${quota.monthSent} / ${quota.monthlyLimit} sent this month (IST)`);

  if (quota.isDailyExceeded) {
    console.error(
      `\nError: Daily email limit reached (${quota.todaySent}/${quota.dailyLimit}). Refusing to send.\n`
    );
    process.exit(1);
  }

  if (quota.isMonthlyExceeded) {
    console.error(
      `\nError: Monthly email limit reached (${quota.monthSent}/${quota.monthlyLimit}). Refusing to send.\n`
    );
    process.exit(1);
  }

  const sentAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const rendered = renderEmail("test_email", {
    recipientName: recipient.split("@")[0],
    sentAt,
  });

  const provider = new ResendProvider(env.RESEND_API_KEY);

  console.log(`Sending sample notification email to: ${recipient}...`);

  const result = await provider.send({
    to: recipient,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: { type: "test_email" },
  });

  if (result.success) {
    // Record in database so it counts toward the quota
    await db.insert(emailQueue).values({
      toEmail: recipient.toLowerCase(),
      toName: recipient.split("@")[0],
      template: "test_email",
      payload: { sentAt },
      status: "sent",
      providerMessageId: result.providerMessageId,
      sentAt: new Date(),
      priority: 3,
    });

    console.log("\n========================================================");
    console.log("SUCCESS! Test email sent successfully.");
    console.log(`Recipient:          ${recipient}`);
    console.log(`Resend Message ID:  ${result.providerMessageId}`);
    console.log("========================================================\n");
    process.exit(0);
  } else {
    console.error("\n========================================================");
    console.error("FAILED to send test email.");
    console.error(`Error Kind:    ${result.error.kind}`);
    console.error(`Error Message: ${result.error.message}`);
    if (result.error.statusCode) {
      console.error(`HTTP Status:   ${result.error.statusCode}`);
    }
    console.error("========================================================\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected script error:", err);
  process.exit(1);
});
