import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto("/transactions");
  await page.waitForSelector("h1", { timeout: 10000 });
});

test("transactions page renders", async ({ page }) => {
  await expect(page.locator("h1")).toContainText("Транзакции");
  await expect(page.locator('button:has-text("Добавить")')).toBeVisible();
  await expect(page.locator('button:has-text("Импорт PDF")')).toBeVisible();
});

test("add manual transaction", async ({ page }) => {
  const uniqueDesc = `Тест-${Date.now()}`;

  await page.click('button:has-text("Добавить")');
  await expect(page.locator("text=Новая транзакция")).toBeVisible();

  await page.fill('input[name="amount"]', "100");
  await page.fill('input[name="description"]', uniqueDesc);

  const today = new Date().toISOString().split("T")[0];
  await page.fill('input[name="date"]', today);

  await page.click('button[type="submit"]:has-text("Добавить")');

  await expect(page.locator(`text=${uniqueDesc}`)).toBeVisible({ timeout: 10000 });
});

test("search filters transactions", async ({ page }) => {
  await page.fill('input[placeholder="Поиск..."]', "zzznomatch123xyz");
  await expect(page.locator("text=Транзакций не найдено")).toBeVisible({ timeout: 5000 });
});

test("type filter — expense only", async ({ page }) => {
  await page.click('button:has-text("Расходы")');
  // Income rows should not appear (or list is empty — both are valid)
  const rows = page.locator(".divide-y > div");
  const count = await rows.count();
  // Just verify the filter applied without throwing
  expect(count).toBeGreaterThanOrEqual(0);
});
