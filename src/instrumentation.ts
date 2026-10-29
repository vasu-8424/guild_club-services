export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    try {
      validateEnv();
      console.log("✅ Environment validation passed at startup.");
    } catch (err: any) {
      console.error("❌ Startup Environment Validation Failed:", err.message);
      // In production, exit immediately so bad config does not run
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
  }
}

