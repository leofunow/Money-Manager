import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto("/analytics");
  await page.waitForSelector("h1", { timeout: 10000 });
});

test("analytics page renders", async ({ page }) => {
  await expect(page.locator("h1")).toContainText("Аналитика");
});

test("shows monthly comparison chart or empty state", async ({ page }) => {
  // Either chart renders or "Нет данных" shows
  const chart = page.locator(".recharts-wrapper, text=Нет данных");
  await expect(chart.first()).toBeVisible({ timeout: 10000 });
});
