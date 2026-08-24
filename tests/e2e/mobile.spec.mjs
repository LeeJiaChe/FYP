import { test, expect } from "@playwright/test";

test("student core flow fits 320 px and keeps seat selection keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill("student1@student.tarc.edu.my");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("navigation", { name: "Student mobile navigation" })).toBeVisible();
  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasPageOverflow).toBe(false);
  await page.getByRole("button", { name: "Book" }).click();
  const response = await page.request.get("/api/routes");
  const { routes } = await response.json();
  const route = routes[0];
  const stops = route.stops ?? route.routeStops.map((item) => item.stop.name);
  await page.getByLabel("From").selectOption({ label: stops[0] });
  await page.getByLabel("To").selectOption({ label: stops.at(-1) });
  await page.getByLabel("Date").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Check seats" }).first().click();
  await expect(page.getByRole("dialog", { name: "Choose your seat" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("student mobile chrome is invariant and tab changes reset the internal scroll viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill("student1@student.tarc.edu.my");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign In" }).click();

  const scrollViewport = page.locator(".student-content");
  const chromeGeometry = () => page.evaluate(() => {
    const header = document.querySelector(".student-shell > header");
    const navigation = document.querySelector(".student-mobile-nav");
    const labels = Array.from(navigation?.querySelectorAll("button > span:last-child") ?? []);
    const navigationButtons = Array.from(navigation?.querySelectorAll("button") ?? []);
    const navigationIcons = Array.from(navigation?.querySelectorAll("button svg") ?? []);
    const brandMark = header?.querySelector(".nav-brand-mark");
    return {
      headerHeight: header?.getBoundingClientRect().height,
      brandMark: brandMark ? { width: brandMark.getBoundingClientRect().width, height: brandMark.getBoundingClientRect().height } : null,
      navigationHeight: navigation?.getBoundingClientRect().height,
      navigationButtonHeights: navigationButtons.map((button) => button.getBoundingClientRect().height),
      navigationIconSizes: navigationIcons.map((icon) => ({ width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height })),
      labels: labels.map((label) => ({ text: label.textContent, height: label.getBoundingClientRect().height })),
      windowScrollY: window.scrollY,
    };
  });
  const initialChrome = await chromeGeometry();

  await page.getByRole("button", { name: "Book" }).click();
  const response = await page.request.get("/api/routes");
  const { routes } = await response.json();
  const route = routes[0];
  const stops = route.stops ?? route.routeStops.map((item) => item.stop.name);
  await page.getByLabel("From").selectOption({ label: stops[0] });
  await page.getByLabel("To").selectOption({ label: stops.at(-1) });
  await page.getByLabel("Date").selectOption({ index: 1 });
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await chromeGeometry()).toEqual(initialChrome);

  await page.getByRole("button", { name: "Journeys" }).click();
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBe(0);
  await scrollViewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await page.getByRole("button", { name: "Track" }).click();
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Account" }).click();
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBe(0);
  const accountRange = await scrollViewport.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(accountRange).toBe(0);
  expect(await chromeGeometry()).toEqual(initialChrome);

  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await chromeGeometry()).toEqual(initialChrome);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  }
});
