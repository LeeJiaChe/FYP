import { test, expect } from "@playwright/test";

test("student core flow fits 320 px and keeps seat selection keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student1@student.tarc.edu.my");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Student mobile navigation" })).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )).toBe(false);
  await page.getByRole("button", { name: "Book", exact: true }).click();
  const response = await page.request.get("/api/routes");
  const { routes } = await response.json();
  const route = routes[0];
  const stops = route.stops ?? route.routeStops.map((item) => item.stop.name);
  await page.getByLabel("From").selectOption({ label: stops[0] });
  await page.getByRole("combobox", { name: /Where are you going/ }).selectOption({ label: stops.at(-1) });
  await page.getByLabel("Date").selectOption({ index: 1 });
  const checkSeats = page.getByRole("button", { name: "Check seats" }).first();
  await checkSeats.click();
  const dialog = page.getByRole("dialog", { name: "Choose your seat" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(checkSeats).toBeFocused();
});

test("student mobile chrome is invariant and tab changes reset the internal scroll viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student1@student.tarc.edu.my");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

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
  await expect(page.getByRole("navigation", { name: "Student mobile navigation" })).toBeVisible();
  const initialChrome = await chromeGeometry();

  await page.getByRole("button", { name: "Book", exact: true }).click();
  const response = await page.request.get("/api/routes");
  const { routes } = await response.json();
  const route = routes[0];
  const stops = route.stops ?? route.routeStops.map((item) => item.stop.name);
  await page.getByLabel("From").selectOption({ label: stops[0] });
  await page.getByRole("combobox", { name: /Where are you going/ }).selectOption({ label: stops.at(-1) });
  await page.getByLabel("Date").selectOption({ index: 1 });
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await chromeGeometry()).toEqual(initialChrome);

  await page.getByRole("navigation", { name: "Student mobile navigation" })
    .getByRole("button", { name: /Journeys/ }).click();
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBe(0);
  await scrollViewport.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "auto" }));
  await page.getByRole("navigation", { name: "Student mobile navigation" })
    .getByRole("button", { name: "Track", exact: true }).click();
  await expect.poll(() => scrollViewport.evaluate((element) => element.scrollTop)).toBe(0);
  await page.getByRole("navigation", { name: "Student mobile navigation" })
    .getByRole("button", { name: "Account", exact: true }).click();
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

for (const role of ["admin", "driver"]) {
  test(`${role} navigation and layout fit mobile, tablet and desktop widths`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(role === "admin" ? "admin1@admin.tarc.edu.my" : "driver1@tarumt.edu.my");
    await page.getByLabel("Password").fill(role === "admin" ? "admin1" : "password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(new RegExp(`/${role}$`));
    expect((await page.request.get("/api/health")).ok()).toBeTruthy();

    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 864 });
      if (role === "admin") {
        const menu = page.getByRole("button", { name: "Administration menu", exact: true });
        if (await menu.isVisible()) {
          await menu.click();
          const nav = page.getByRole("navigation", { name: "Administration sections" });
          await expect(nav).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(menu).toBeFocused();
        } else {
          await expect(page.getByRole("navigation", { name: "Administration sections" })).toBeVisible();
        }
      } else {
        const nav = page.getByRole("navigation", { name: "Driver workspace" });
        await expect(nav).toBeVisible();
        const timetable = nav.getByRole("button", { name: "Timetable" });
        await timetable.focus();
        await page.keyboard.press("Enter");
        await expect(timetable).toHaveAttribute("aria-current", "page");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${width}px`).toBe(true);
    }
  });
}
