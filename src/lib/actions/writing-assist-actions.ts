"use server";

import { z } from "zod";
import { requireRole } from "@/lib/session";
import { maskSensitiveText, unmaskSensitiveText } from "@/lib/writing-assist/mask";

const writingAssistSchema = z.object({
  text: z.string().min(10, "Text must be at least 10 characters").max(3000, "Text must be under 3,000 characters"),
  mode: z.enum(["fix_grammar", "suggest_improvements", "summarize", "simplify", "shorten"]),
  context: z.enum([
    "session_note",
    "patient_condition",
    "progress_report",
    "closing_summary",
    "admin_note",
    "general",
  ]),
  knownNames: z.array(z.string()).optional().default([]),
});

export type WritingAssistMode =
  | "fix_grammar"
  | "suggest_improvements"
  | "summarize"
  | "simplify"
  | "shorten";

export interface WritingAssistInput {
  text: string;
  mode: WritingAssistMode;
  context:
  | "session_note"
  | "patient_condition"
  | "progress_report"
  | "closing_summary"
  | "admin_note"
  | "general";
  knownNames?: string[];
}

export interface WritingSuggestion {
  id: string;
  category: "clarity" | "missing_detail" | "tone";
  suggestion: string;
  reason: string;
}

export interface WritingAssistResponse {
  success: boolean;
  correctedText?: string;
  suggestions?: WritingSuggestion[];
  error?: string;
  isAvailable?: boolean;
}

// In-memory hourly rate limiting map: userId -> timestamps array
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const timestamps = (rateLimitMap.get(userId) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= 30) {
    return false;
  }

  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

// Global mock state for testing
const globalForMock = globalThis as unknown as {
  lastAssistCall?: {
    maskedText: string;
    mode: string;
    context: string;
  };
  mockProviderDelay?: number;
  mockSimulateTimeout?: boolean;
};

export async function writingAssistAction(
  rawInput: unknown
): Promise<WritingAssistResponse> {
  // 1. Auth check: any logged in user can use writing assist on their text
  const currentUser = await requireRole("super_admin", "admin", "therapist");
  if (!currentUser) {
    return { success: false, error: "Unauthorized" };
  }

  // 2. Validate input
  const parsed = writingAssistSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { text, mode, context, knownNames } = parsed.data;

  // 3. Rate limiting: 30 checks per user per hour
  if (!checkRateLimit(currentUser.id)) {
    return {
      success: false,
      error: "Hourly limit reached (30 checks/hour). Please try again later.",
    };
  }

  // 4. Provider configuration
  const provider = (process.env.WRITING_ASSIST_PROVIDER || "off").trim().toLowerCase();
  const apiKey = process.env.WRITING_ASSIST_API_KEY || "";

  if (provider === "off") {
    return {
      success: false,
      isAvailable: false,
      error: "Writing assistant is disabled.",
    };
  }

  // 5. Privacy masking: Strip patient IDs, phones, emails, DOBs, known names
  const { maskedText, mappings } = maskSensitiveText(text, knownNames);

  // Store metadata for tests if in test mode
  if (process.env.NODE_ENV === "test" || process.env.PLAYWRIGHT_TEST || provider === "mock") {
    globalForMock.lastAssistCall = {
      maskedText,
      mode,
      context,
    };
  }

  const startTime = Date.now();

  try {
    // 6. Invoke provider with 15-second server timeout
    const timeoutPromise = new Promise<{ correctedMaskedText: string; suggestions?: WritingSuggestion[] }>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), 15000);
    });

    const callPromise = callProvider({
      provider,
      apiKey,
      maskedText,
      mode,
      context,
    });

    const result = await Promise.race([callPromise, timeoutPromise]);

    // 7. Unmask the response text so the user's original names/identifiers are restored
    let correctedText = unmaskSensitiveText(result.correctedMaskedText, mappings);

    // Sanitize output: render untrusted response as plain text, limit to 4000 chars
    correctedText = correctedText
      .replace(/<[^>]*>?/gm, "")
      .trim()
      .slice(0, 4000);

    const latency = Date.now() - startTime;
    // Safe dev log only: never log raw or output text
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Writing Assist] Mode: ${mode}, Context: ${context}, Length: ${text.length}, Latency: ${latency}ms, Status: Success`);
    }

    return {
      success: true,
      isAvailable: true,
      correctedText,
      suggestions: result.suggestions,
    };
  } catch {
    const latency = Date.now() - startTime;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Writing Assist] Mode: ${mode}, Context: ${context}, Length: ${text.length}, Latency: ${latency}ms, Status: Failure`);
    }

    return {
      success: false,
      isAvailable: true,
      error: "AI assistant is unavailable right now. Your text is safe.",
    };
  }
}

function getModeInstruction(mode: WritingAssistMode): string {
  switch (mode) {
    case "fix_grammar":
      return "Fix only spelling, punctuation, and grammatical mistakes. Keep wording changes minimal. Return ONLY the final corrected paragraph.";
    case "summarize":
      return "Provide a clear, concise clinical summary of the patient observation or notes while retaining all diagnostic facts, metrics, and progress details. Return ONLY the summary paragraph.";
    case "simplify":
      return "Rewrite the text to simplify complex clinical jargon into plain, patient-accessible terms without compromising clinical accuracy. Return ONLY the simplified paragraph.";
    case "shorten":
      return "Make the text concise, crisp, and direct, removing redundant filler while retaining all key clinical facts. Return ONLY the shortened paragraph.";
    case "suggest_improvements":
      return "Fix grammar and provide up to 3 short actionable clinical improvements (clarity, missing details, objective tone). Output as a valid JSON object with keys: 'correctedText' (string) and 'suggestions' (array of objects with category ['clarity'|'missing_detail'|'tone'], suggestion, reason). Do not wrap in markdown codeblocks.";
  }
}

async function callProvider({
  provider,
  apiKey,
  maskedText,
  mode,
  context,
}: {
  provider: string;
  apiKey: string;
  maskedText: string;
  mode: WritingAssistMode;
  context: string;
}): Promise<{ correctedMaskedText: string; suggestions?: WritingSuggestion[] }> {
  // Check for test mock simulation
  if (globalForMock.mockSimulateTimeout) {
    await new Promise((r) => setTimeout(r, 16000));
  }

  if (provider === "mock" || process.env.PLAYWRIGHT_TEST || !apiKey) {
    let correctedMaskedText = maskedText;

    if (mode === "summarize") {
      correctedMaskedText = `Summary: ${maskedText.replace(/\brecieved\b/gi, "received").replace(/\bpatient were\b/gi, "patient was").replace(/\bsession went good\b/gi, "session went well").slice(0, 160)}.`;
    } else if (mode === "simplify") {
      correctedMaskedText = maskedText
        .replace(/functional ambulation/gi, "walking ability")
        .replace(/bilateral lower extremities/gi, "both legs")
        .replace(/\brecieved\b/gi, "received")
        .replace(/\bpatient were\b/gi, "patient was")
        .replace(/\bsession went good\b/gi, "session went well");
    } else if (mode === "shorten") {
      correctedMaskedText = maskedText
        .replace(/over the past two weeks/gi, "recently")
        .replace(/\brecieved\b/gi, "received")
        .replace(/\bpatient were\b/gi, "patient was")
        .replace(/\bsession went good\b/gi, "session went well");
    } else {
      // fix_grammar & suggest_improvements
      correctedMaskedText = correctedMaskedText
        .replace(/\brecieved\b/gi, "received")
        .replace(/\bpatient were\b/gi, "patient was")
        .replace(/\bsession went good\b/gi, "session went well");
    }

    if (correctedMaskedText.length > 0) {
      correctedMaskedText = correctedMaskedText.charAt(0).toUpperCase() + correctedMaskedText.slice(1);
    }

    const suggestions: WritingSuggestion[] =
      mode === "suggest_improvements"
        ? [
          {
            id: "sug-1",
            category: "clarity",
            suggestion: "Specify measurable response times during vocal exercises.",
            reason: "Enhances clinical objectivity.",
          },
          {
            id: "sug-2",
            category: "missing_detail",
            suggestion: "Note patient comfort level and fatigue.",
            reason: "Essential for subsequent session calibration.",
          },
        ]
        : [];

    return { correctedMaskedText, suggestions };
  }

  if (provider === "gemini") {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const instruction = getModeInstruction(mode);
    const prompt = `You are an expert clinical writing assistant for therapy documentation.
Context: ${context}.
Mode: ${mode}.
Task instruction: ${instruction}
Strict requirements:
1. Preserve all placeholders like [PERSON_1], [ID_1], [PHONE_1], [EMAIL_1], [DOB_1] exactly as they appear.
2. Return plain text only without markdown formatting (no bold asterisks **, no bullet points, no markdown quotes, or HTML tags).
3. Do not include conversational greetings, explanations, or lists of corrections made. Output ONLY the replacement text itself.

Text to review:
${maskedText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const reply = response.text || "";

    if (mode === "suggest_improvements") {
      try {
        const cleanJson = reply.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return {
          correctedMaskedText: (parsed.correctedText || maskedText).replace(/\*\*/g, "").trim(),
          suggestions: (parsed.suggestions || []).slice(0, 3).map((s: any, idx: number) => ({
            id: `sug-${idx + 1}`,
            category: s.category || "clarity",
            suggestion: s.suggestion,
            reason: s.reason,
          })),
        };
      } catch {
        const cleanText = reply.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
        return { correctedMaskedText: cleanText };
      }
    }

    const cleanText = reply.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
    return { correctedMaskedText: cleanText };
  }

  if (provider === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are a clinical writing assistant for therapy documentation. Context: ${context}.
Do not change placeholders like [PERSON_1], [ID_1], [PHONE_1], [EMAIL_1], [DOB_1]. Return plain text only without markdown bolding.`;

    const instruction = getModeInstruction(mode);
    const userPrompt = `${instruction}\n\nText:\n${maskedText}`;

    const msg = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const contentBlock = msg.content[0];
    const reply = contentBlock.type === "text" ? contentBlock.text : "";

    if (mode === "suggest_improvements") {
      try {
        const cleanJson = reply.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return {
          correctedMaskedText: (parsed.correctedText || maskedText).replace(/\*\*/g, "").trim(),
          suggestions: (parsed.suggestions || []).slice(0, 3).map((s: any, idx: number) => ({
            id: `sug-${idx + 1}`,
            category: s.category || "clarity",
            suggestion: s.suggestion,
            reason: s.reason,
          })),
        };
      } catch {
        const cleanText = reply.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
        return { correctedMaskedText: cleanText };
      }
    }

    const cleanText = reply.replace(/\*\*/g, "").replace(/^["']|["']$/g, "").trim();
    return { correctedMaskedText: cleanText };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function isWritingAssistEnabledAction(): Promise<boolean> {
  const provider = (process.env.WRITING_ASSIST_PROVIDER || "off").trim().toLowerCase();
  return provider !== "off";
}

