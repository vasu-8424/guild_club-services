import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    APP_TIMEZONE: z.string().default("Asia/Kolkata"),
    EMAIL_PROVIDER: z
      .string()
      .default("mock")
      .transform((val) => val.trim().toLowerCase())
      .pipe(z.enum(["mock", "resend"])),
    RESEND_API_KEY: z.string().optional().default(""),
    EMAIL_FROM_NAME: z.string().default("Guild Club Services"),
    EMAIL_FROM_ADDRESS: z.string().optional().default("noreply@guildclubservices.com"),
    EMAIL_FROM_DOMAIN: z.string().optional().default("guildclubservices.com"),
    EMAIL_REPLY_TO: z.string().optional().default(""),
    EMAIL_DAILY_LIMIT: z
      .string()
      .or(z.number())
      .default(90)
      .transform((val) => {
        const num = typeof val === "number" ? val : parseInt(val, 10);
        return isNaN(num) ? 90 : num;
      }),
    EMAIL_MONTHLY_LIMIT: z
      .string()
      .or(z.number())
      .default(2800)
      .transform((val) => {
        const num = typeof val === "number" ? val : parseInt(val, 10);
        return isNaN(num) ? 2800 : num;
      }),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    CRON_SECRET: z.string().optional().default(""),
    RESEND_WEBHOOK_SECRET: z.string().optional().default(""),
    ALLOW_REAL_EMAIL_TESTS: z
      .string()
      .or(z.boolean())
      .default(false)
      .transform((val) => val === true || val === "true"),
    INCLUDE_PASSWORD_IN_EMAIL: z
      .string()
      .or(z.boolean())
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return true;
        if (val === false || val === "false" || val === "0") return false;
        return true;
      }),
    NOTIFY_SUPER_ADMINS_ON_CLOSE: z
      .string()
      .or(z.boolean())
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return true;
        if (val === false || val === "false" || val === "0") return false;
        return true;
      }),
    NOTIFY_ADMIN_ON_SESSION_COMPLETE: z
      .string()
      .or(z.boolean())
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return true;
        if (val === false || val === "false" || val === "0") return false;
        return true;
      }),
    REQUIRE_LOCATION_ON_LOGIN: z
      .string()
      .or(z.boolean())
      .optional()
      .default(false)
      .transform((val) => {
        if (val === true || val === "true" || val === "1") return true;
        return false;
      }),
    NOTE_EMAIL_ENABLED: z
      .string()
      .or(z.boolean())
      .optional()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return true;
        if (val === false || val === "false" || val === "0") return false;
        return true;
      }),
    WRITING_ASSIST_PROVIDER: z
      .string()
      .optional()
      .default("off")
      .transform((val) => val.trim().toLowerCase())
      .pipe(z.enum(["off", "gemini", "anthropic", "mock"])),
    WRITING_ASSIST_API_KEY: z.string().optional().default(""),
  })
  .superRefine((data, ctx) => {
    // 1. Production Safety Rule: EMAIL_PROVIDER=mock is impossible in production
    if (
      process.env.NODE_ENV === "production" &&
      process.env.PLAYWRIGHT_TEST !== "true" &&
      process.env.PLAYWRIGHT_TEST !== "1" &&
      data.EMAIL_PROVIDER === "mock"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "EMAIL_PROVIDER cannot be 'mock' in production environment",
        path: ["EMAIL_PROVIDER"],
      });
    }

    // 2. If EMAIL_PROVIDER is resend, enforce required variables
    if (data.EMAIL_PROVIDER === "resend") {
      if (!data.RESEND_API_KEY || data.RESEND_API_KEY.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RESEND_API_KEY is required when EMAIL_PROVIDER is 'resend'",
          path: ["RESEND_API_KEY"],
        });
      }

      if (!data.EMAIL_FROM_ADDRESS || !data.EMAIL_FROM_ADDRESS.includes("@")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "EMAIL_FROM_ADDRESS is required and must be a valid email when EMAIL_PROVIDER is 'resend'",
          path: ["EMAIL_FROM_ADDRESS"],
        });
      } else {
        const domain = data.EMAIL_FROM_ADDRESS.split("@")[1]?.toLowerCase();
        if (data.EMAIL_FROM_DOMAIN && data.EMAIL_FROM_DOMAIN.trim() !== "") {
          const expectedDomain = data.EMAIL_FROM_DOMAIN.trim().toLowerCase();
          if (domain !== expectedDomain) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `EMAIL_FROM_ADDRESS must be on the verified domain specified by EMAIL_FROM_DOMAIN (${expectedDomain})`,
              path: ["EMAIL_FROM_ADDRESS"],
            });
          }
        }
      }
    }

    // 3. If WRITING_ASSIST_PROVIDER is gemini or anthropic, require API key
    if (data.WRITING_ASSIST_PROVIDER === "gemini" || data.WRITING_ASSIST_PROVIDER === "anthropic") {
      if (!data.WRITING_ASSIST_API_KEY || data.WRITING_ASSIST_API_KEY.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `WRITING_ASSIST_API_KEY is required when WRITING_ASSIST_PROVIDER is '${data.WRITING_ASSIST_PROVIDER}'`,
          path: ["WRITING_ASSIST_API_KEY"],
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function validateEnv(customSource?: Record<string, string | undefined>): EnvConfig {
  const raw = customSource ?? {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || (process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1]),
    EMAIL_FROM_DOMAIN: process.env.EMAIL_FROM_DOMAIN,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    EMAIL_DAILY_LIMIT: process.env.EMAIL_DAILY_LIMIT,
    EMAIL_MONTHLY_LIMIT: process.env.EMAIL_MONTHLY_LIMIT,
    APP_BASE_URL: process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    ALLOW_REAL_EMAIL_TESTS: process.env.ALLOW_REAL_EMAIL_TESTS,
    INCLUDE_PASSWORD_IN_EMAIL: process.env.INCLUDE_PASSWORD_IN_EMAIL,
    NOTIFY_SUPER_ADMINS_ON_CLOSE: process.env.NOTIFY_SUPER_ADMINS_ON_CLOSE,
    NOTIFY_ADMIN_ON_SESSION_COMPLETE: process.env.NOTIFY_ADMIN_ON_SESSION_COMPLETE,
    REQUIRE_LOCATION_ON_LOGIN: process.env.REQUIRE_LOCATION_ON_LOGIN,
    NOTE_EMAIL_ENABLED: process.env.NOTE_EMAIL_ENABLED,
    WRITING_ASSIST_PROVIDER: process.env.WRITING_ASSIST_PROVIDER,
    WRITING_ASSIST_API_KEY: process.env.WRITING_ASSIST_API_KEY,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${errorDetails}`);
  }

  // Guard against sending real emails during automated tests
  if (
    process.env.NODE_ENV === "test" ||
    process.env.PLAYWRIGHT_TEST === "true" ||
    process.env.CI === "true"
  ) {
    if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.ALLOW_REAL_EMAIL_TESTS) {
      throw new Error(
        "CRITICAL SAFETY GUARD: Automated test run detected with EMAIL_PROVIDER=resend. Real email delivery is blocked to prevent accidental emails to clinical staff."
      );
    }
  }

  return parsed.data;
}

export function getEnv(): EnvConfig {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

export function resetCachedEnv(): void {
  cachedEnv = null;
}

export const resetEnvCache = resetCachedEnv;

export function getFormattedSender(customEnv?: EnvConfig): string {
  const env = customEnv || getEnv();
  return `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;
}
