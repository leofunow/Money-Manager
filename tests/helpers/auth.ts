import { type Page } from "@playwright/test";

export async function loginAs(page: Page, email?: string, password?: string) {
  const e = email ?? process.env.TEST_EMAIL ?? "";
  const p = password ?? process.env.TEST_PASSWORD ?? "";

  await page.goto("/login");
  await page.fill('input[type="email"]', e);
  await page.fill('input[type="password"]', p);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|settings)/, { timeout: 15000 });
}
