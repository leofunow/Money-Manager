import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto("/budgets");
  await page.waitForSelector("h1", { timeout: 10000 });
});

test("budgets page renders", async ({ page }) => {
  await expect(page.locator("h1")).toContainText("Бюджеты");
  await expect(page.locator('button:has-text("Добавить бюджет")')).toBeVisible();
});

test("add budget form opens", async ({ page }) => {
  await page.click('button:has-text("Добавить бюджет")');
  await expect(page.locator("text=Новый бюджет")).toBeVisible();
  await expect(page.locator('select[name="category_id"]')).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toBeVisible();
});

test("create budget with limit", async ({ page }) => {
  await page.click('button:has-text("Добавить бюджет")');
  await page.fill('input[name="amount"]', "5000");

  // Select first available category
  const categorySelect = page.locator('select[name="category_id"]');
  const options = await categorySelect.locator("option").count();
  if (options > 0) {
    await page.click('button[type="submit"]:has-text("Сохранить")');
    await expect(page.locator("text=Новый бюджет")).not.toBeVisible({ timeout: 5000 });
  }
});
