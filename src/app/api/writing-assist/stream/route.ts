import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { maskSensitiveText, unmaskSensitiveText } from "@/lib/writing-assist/mask";

export const dynamic = "force-dynamic";

const streamRequestSchema = z.object({
  text: z.string().min(10).max(3000),
  mode: z.enum(["fix_grammar", "suggest_improvements", "summarize", "simplify", "shorten"]).default("fix_grammar"),
  context: z.enum([
    "session_note",
    "patient_condition",
    "progress_report",
    "closing_summary",
    "admin_note",
    "general",
  ]).default("general"),
  knownNames: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("super_admin", "admin", "therapist");
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = streamRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { text, mode, context, knownNames } = parsed.data;
    const provider = (process.env.WRITING_ASSIST_PROVIDER || "off").trim().toLowerCase();
    const apiKey = process.env.WRITING_ASSIST_API_KEY || "";

    if (provider === "off") {
      return NextResponse.json({ error: "Writing assist is disabled" }, { status: 400 });
    }

    const { maskedText, mappings } = maskSensitiveText(text, knownNames);

    // If mock provider or no apiKey or test mode
    if (provider === "mock" || process.env.PLAYWRIGHT_TEST || !apiKey) {
      let corrected = maskedText
        .replace(/\brecieved\b/gi, "received")
        .replace(/\bpatient were\b/gi, "patient was")
        .replace(/\bsession went good\b/gi, "session went well");

      if (mode === "summarize") {
        corrected = `Summary: ${corrected.slice(0, 160)}.`;
      } else if (mode === "simplify") {
        corrected = corrected.replace(/functional ambulation/gi, "walking ability");
      }

      const unmasked = unmaskSensitiveText(corrected, mappings);

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = unmasked.split(" ");
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? "" : " ") + words[i];
            controller.enqueue(encoder.encode(chunk));
            await new Promise((r) => setTimeout(r, 20));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    if (provider === "gemini") {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      let instruction = "Fix only spelling, punctuation, and grammatical mistakes.";
      if (mode === "summarize") instruction = "Provide a concise clinical summary.";
      else if (mode === "simplify") instruction = "Simplify complex clinical terms into clear, plain language.";
      else if (mode === "shorten") instruction = "Make the text concise and direct.";

      const prompt = `You are a clinical writing assistant for therapy documentation.
Context: ${context}. Mode: ${mode}.
Task: ${instruction}
Requirements:
1. Preserve placeholders like [PERSON_1], [ID_1], [PHONE_1], [EMAIL_1], [DOB_1].
2. Output ONLY the replacement text itself without formatting, bolding, or greetings.

Text:
${maskedText}`;

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let accumulated = "";
          for await (const chunk of responseStream) {
            const piece = chunk.text || "";
            accumulated += piece;
          }
          const clean = accumulated.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
          const unmasked = unmaskSensitiveText(clean, mappings);
          controller.enqueue(encoder.encode(unmasked));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json({ error: "Unsupported provider for stream" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "AI assistant is unavailable right now. Your text is safe." },
      { status: 500 }
    );
  }
}

