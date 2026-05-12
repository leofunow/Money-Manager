import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.beforeEach(async ({ page }) => {
  await loginAs(page);
  await page.goto("/settings");
  await page.waitForSelector("h1", { timeout: 10000 });
});

test("settings page renders profile", async ({ page }) => {
  await expect(page.locator("h1")).toContainText("Настройки");
  await expect(page.locator("text=Профиль")).toBeVisible();
});

test("settings shows household section", async ({ page }) => {
  await expect(page.locator("text=Домохозяйство")).toBeVisible();
});

test("clicking avatar navigates to settings", async ({ page }) => {
  // Navigate away first
  await page.goto("/dashboard");
  await page.waitForSelector("header");

  // Click the avatar link in header
  await page.click('header a[href="/settings"]');
  await expect(page).toHaveURL(/\/settings/);
});
