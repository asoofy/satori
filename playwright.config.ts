import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3400;
// A throwaway database for end-to-end runs (reset by scripts/e2e-reset.mjs before the server starts).
const E2E_DB = path.join(__dirname, ".e2e", "satori-e2e.db");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // the tests share one database and build on each other
  retries: 0, // tests share state, so a retry wouldn’t start clean
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node scripts/e2e-reset.mjs && npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { SATORI_DB_PATH: E2E_DB, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
