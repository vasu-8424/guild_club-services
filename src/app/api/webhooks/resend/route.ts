import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { emailQueue, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getEnv } from "@/lib/env";

export function verifyResendWebhookSignature(
  rawBody: string,
  headers: {
    id: string | null;
    timestamp: string | null;
    signature: string | null;
  },
  secret: string
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) {
    return false;
  }

  // Prevent replay attacks (5 minute threshold)
  const timestampMs = parseInt(headers.timestamp, 10) * 1000;
  if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;

  let key: Buffer;
  if (secret.startsWith("whsec_")) {
    key = Buffer.from(secret.slice(6), "base64");
  } else {
    key = Buffer.from(secret, "utf-8");
  }

  const computedSignature = crypto
    .createHmac("sha256", key)
    .update(signedContent)
    .digest("base64");

  const candidateSignatures = headers.signature
    .split(" ")
    .map((s) => s.replace(/^v1,/, ""));

  return candidateSignatures.some((sig) => {
    try {
      const a = Buffer.from(sig, "base64");
      const b = Buffer.from(computedSignature, "base64");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

export async function POST(req: Request) {
  const env = getEnv();
  const webhookSecret = env.RESEND_WEBHOOK_SECRET;

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  const rawBody = await req.text();

  // If RESEND_WEBHOOK_SECRET is configured, enforce cryptographic signature check
  if (webhookSecret && webhookSecret.trim() !== "") {
    const isValid = verifyResendWebhookSignature(
      rawBody,
      {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing webhook signature" },
        { status: 401 }
      );
    }
  } else {
    // If not configured, reject unsigned external webhook calls
    if (!svixSignature && !svixId) {
      return NextResponse.json(
        { error: "Unauthorized: Unsigned webhook payload" },
        { status: 401 }
      );
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType: string = event.type || "";
  const data = event.data || {};
  const emailId: string = data.email_id || "";
  const recipients: string[] = Array.isArray(data.to) ? data.to : [];

  try {
    if (eventType === "email.delivered" && emailId) {
      await db
        .update(emailQueue)
        .set({ status: "delivered" })
        .where(eq(emailQueue.providerMessageId, emailId));
    } else if (
      (eventType === "email.bounced" || eventType === "email.complained") &&
      emailId
    ) {
      const status = eventType === "email.bounced" ? "bounced" : "complained";
      const errorMsg =
        status === "bounced"
          ? "Hard bounce: address rejected by mail server"
          : "Spam complaint received from recipient";

      // 1. Update delivery record
      await db
        .update(emailQueue)
        .set({
          status,
          lastError: errorMsg,
          emailUndeliverable: true,
        })
        .where(eq(emailQueue.providerMessageId, emailId));

      // 2. Mark recipient user(s) as undeliverable
      if (recipients.length > 0) {
        await db
          .update(users)
          .set({ emailUndeliverable: true })
          .where(inArray(users.email, recipients.map((r) => r.toLowerCase())));
      }
    } else if (eventType === "email.delivery_delayed" && emailId) {
      await db
        .update(emailQueue)
        .set({
          lastError: "Delivery delayed by recipient provider (temporary deferral)",
        })
        .where(eq(emailQueue.providerMessageId, emailId));
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Resend event processing error:", err);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }
}
