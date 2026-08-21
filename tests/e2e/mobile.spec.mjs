import { test, expect } from "@playwright/test";

test("student core flow fits 320 px and keeps the booking dialog keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill("student1@student.tarc.edu.my");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Student Shuttle Portal" })).toBeVisible();
  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasPageOverflow).toBe(false);
  await page.getByRole("button", { name: /Choose From and To/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
