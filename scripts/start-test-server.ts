import * as dotenv from "dotenv";
import path from "path";
import { spawn } from "child_process";
import { assertTestDatabase } from "../tests/helpers/seed-test-data";

// 1. Force load .env.test with override
dotenv.config({ path: path.resolve(process.cwd(), ".env.test"), override: true });

// 2. Assert strictly that DATABASE_URL is test branch
const testDbUrl = assertTestDatabase();
console.log("🚀 Starting test server connected to:", testDbUrl.replace(/:[^:@]+@/, ":***@"));

// 3. Spawn next start with process.env inherited
const port = process.env.PORT || "3000";
const nextProcess = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "-p", port],
  {
    stdio: "inherit",
    env: { ...process.env, PORT: port, PLAYWRIGHT_TEST: "true" },
    shell: true,
  }
);

nextProcess.on("close", (code) => {
  console.log(`Test server exited with code ${code}`);
  process.exit(code || 0);
});
