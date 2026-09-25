import { expect, type Page, test } from "@playwright/test";

/** Navigate and wait until the page has hydrated (so typed input isn't lost). */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

// These run in order against one fresh database (see playwright.config.ts).
test.describe.serial("Satori smoke tests", () => {
  test("onboarding leads to the dashboard", async ({ page }) => {
    await go(page, "/");
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByPlaceholder("Your first name").fill("Robin");
    // Pick the first suggested test date.
    await page.locator("fieldset button").first().click();
    await page.getByRole("button", { name: "Start studying" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Robin");
    await expect(page.getByText("SAT countdown", { exact: false })).toBeVisible();
    await expect(page.getByText(/days? until/)).toBeVisible();
  });

  test("practice a question from the bank: answer, explanation, save", async ({ page }) => {
    await go(page, "/questions?q=museum%20opened%20a%20new%20wing");
    await expect(page.getByText("1 question match")).toBeVisible();
    await page.getByRole("button", { name: "Try it" }).click();
    await expect(page.getByRole("radiogroup", { name: "Answer choices" })).toBeVisible();
    // Answer wrong on purpose (the key is B).
    await page.getByRole("radio").filter({ hasText: "spring," }).first().click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText(/Not quite/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Explanation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why the other choices are wrong" })).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  });

  test("grid-in answers accept equivalent forms", async ({ page }) => {
    await go(page, "/questions?q=4(x%20-%203)");
    await page.getByRole("button", { name: "Try it" }).click();
    await page.waitForURL(/\/practice\//);
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox").fill("16/2");
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
  });

  test("mistakes can be redone and cleared", async ({ page }) => {
    await go(page, "/saved?tab=mistakes");
    await expect(page.getByRole("tab", { name: "Mistakes (1)" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Saved (1)" })).toBeVisible();
    await page.getByRole("button", { name: "Start redo set" }).click();
    await page.getByRole("radio").filter({ hasText: "spring;" }).click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await go(page, "/saved?tab=mistakes");
    await expect(page.getByRole("tab", { name: "Mistakes (0)" })).toBeVisible();
  });

  test("build a study plan and open the learn path", async ({ page }) => {
    await go(page, "/plan");
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page.getByText("Days done")).toBeVisible();
    await go(page, "/path");
    await expect(page.getByText("SAT study path")).toBeVisible();
    await expect(page.getByRole("heading", { name: "September 2026" }).or(page.locator("h2[aria-live]"))).toBeVisible();
  });

  test("single-module practice test: begin, review, submit, report", async ({ page }) => {
    await go(page, "/tests");
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Math" }) }).last().getByRole("button", { name: "Math" }).click();
    await expect(page.getByRole("heading", { name: /Module: Math/ })).toBeVisible();
    await page.getByRole("button", { name: "Begin" }).click();
    await expect(page.getByRole("timer", { name: "Time remaining" })).toBeVisible();
    await page.getByRole("button", { name: /Question 1 of 22/ }).click();
    await page.getByRole("button", { name: "Go to review page" }).click();
    await page.getByRole("button", { name: "Submit and see results" }).click();
    await page.getByRole("button", { name: "Yes, submit" }).click();
    await expect(page.getByRole("heading", { name: "Score report" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Math (estimate)")).toBeVisible();
  });

  test("vocab flashcards and analytics", async ({ page }) => {
    await go(page, "/vocab");
    await page.getByRole("button", { name: "Show the definition" }).click();
    await page.getByRole("button", { name: /Good/ }).click();
    await expect(page.getByText(/Card 2 of/)).toBeVisible();
    await go(page, "/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Accuracy by week")).toBeVisible();
  });

  test("settings: theme switch and profiles", async ({ page }) => {
    await go(page, "/settings");
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await go(page, "/leaderboard");
    await expect(page.getByRole("cell", { name: /Robin/ })).toBeVisible();
  });
});
