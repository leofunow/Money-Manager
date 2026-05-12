import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test("login → redirects to dashboard", async ({ page }) => {
  await loginAs(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator("h1")).toContainText("Дашборд");
});

test("unauthenticated → redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("logout → returns to login", async ({ page }) => {
  await loginAs(page);
  await page.click('button[aria-label="Выйти"]');
  await expect(page).toHaveURL(/\/login/);
});
