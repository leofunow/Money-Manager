import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto("/goals");
  await page.waitForSelector("h1", { timeout: 10000 });
});

test("goals page renders", async ({ page }) => {
  await expect(page.locator("h1")).toContainText("Цели накоплений");
  await expect(page.locator('button:has-text("Новая цель")')).toBeVisible();
});

test("create new goal", async ({ page }) => {
  const goalName = `Цель-${Date.now()}`;

  await page.click('button:has-text("Новая цель")');
  await expect(page.locator("text=Новая цель")).toBeVisible();

  await page.fill('input[name="name"]', goalName);
  await page.fill('input[name="target_amount"]', "50000");

  await page.click('button[type="submit"]:has-text("Создать цель")');

  await expect(page.locator(`text=${goalName}`)).toBeVisible({ timeout: 10000 });
});
