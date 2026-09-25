// Capture README screenshots from a running Satori server.
//   node scripts/screenshots.mjs [baseUrl]
// It answers some practice questions and builds a plan first so the pages have data,
// so point it at a throwaway database (e.g. SATORI_DB_PATH=./.e2e/shots.db npm run dev).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const out = path.join(process.cwd(), "docs", "screenshots");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, colorScheme: "light" });
const go = async (url) => {
  await page.goto(base + url);
  await page.waitForLoadState("networkidle");
};
const shot = async (name) => {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("saved", name);
};

// Onboarding (only on a fresh database)
await go("/");
if (page.url().includes("/onboarding")) {
  await page.getByPlaceholder("Your first name").fill("Alex");
  await page.locator("fieldset button").nth(3).click();
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.waitForURL(base + "/");
}

// Some practice so the dashboard and analytics have data
await go("/plan");
const build = page.getByRole("button", { name: "Build my plan" });
if (await build.count()) await build.click();
await go("/");
await page.getByRole("button", { name: "Start today’s session" }).click();
await page.waitForURL(/\/practice\//);
await page.waitForLoadState("networkidle");
for (let i = 0; i < 10; i++) {
  await page.getByRole("button", { name: "Check answer" }).waitFor({ timeout: 10_000 }).catch(async () => {
    throw new Error(`question ${i + 1}: no "Check answer" button. Page says: ${(await page.locator("main").innerText()).slice(0, 400)}`);
  });
  const radios = page.getByRole("radio");
  if (await radios.count()) await radios.nth(i % 4).click();
  else await page.getByRole("textbox").fill(String((i % 5) + 2));
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByRole("button", { name: /^(Next →|See results)$/ }).waitFor();
  if (i === 1) await shot("practice");
  await page.getByRole("button", { name: /^(Next →|See results)$/ }).click();
}

await go("/");
await shot("home");
await go("/questions?section=MATH");
await shot("question-bank");
await go("/path");
await shot("learn-path");
await go("/analytics");
await shot("analytics");
await go("/lessons/boundaries");
await shot("lesson");
await go("/tests");
await shot("tests");

await browser.close();
