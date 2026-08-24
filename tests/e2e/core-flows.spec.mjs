import { test, expect } from "@playwright/test";

async function login(page, identity, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill(identity);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(?:student|driver|admin)$/);
}

async function openJourney(page, routeName) {
  await page.getByRole("button", { name: "Book Shuttle" }).click();
  const response = await page.request.get("/api/routes");
  const { routes } = await response.json();
  const route = routes.find((item) => item.name === routeName);
  const stops = route.stops ?? route.routeStops.map((item) => item.stop.name);
  await page.getByLabel("From").selectOption({ label: stops[0] });
  await page.getByLabel("To").selectOption({ label: stops.at(-1) });
  await page.getByLabel("Date").selectOption({ index: 1 });
  const departure = page.getByRole("article").filter({ hasText: routeName }).first();
  await departure.getByRole("button", { name: "Check seats" }).click();
  await expect(page.getByRole("dialog", { name: "Choose your seat" })).toBeVisible();
}

async function selectOptionContaining(select, text) {
  const value = await select.locator("option").filter({ hasText: text }).getAttribute("value");
  if (!value) throw new Error(`No option containing "${text}"`);
  await select.selectOption(value);
}

test("fresh seed exposes the ten canonical directional routes without retired placeholders", async ({ page }) => {
  await login(page, "admin1@admin.tarc.edu.my", "admin1");
  const response = await page.request.get("/api/admin/routes");
  expect(response.ok()).toBeTruthy();
  const { routes } = await response.json();
  expect(routes).toHaveLength(10);
  expect(routes.map((route) => route.name).sort()).toEqual([
    "Jalan Genting Klang → TAR UMT",
    "Melati Utama → TAR UMT",
    "PV10/PV12/PV13 corridor → TAR UMT",
    "TAR UMT → Jalan Genting Klang",
    "TAR UMT → Melati Utama",
    "TAR UMT → PV10/PV12/PV13 corridor",
    "TAR UMT → Teratai Residency",
    "TAR UMT → Wangsa Maju Section 2",
    "Teratai Residency → TAR UMT",
    "Wangsa Maju Section 2 → TAR UMT",
  ]);
  for (const route of routes) {
    expect(route.routeStops.length).toBeGreaterThanOrEqual(2);
    expect(route.routeStops.map((stop) => stop.position)).toEqual(
      route.routeStops.map((_, position) => position),
    );
  }
  expect(JSON.stringify(routes)).not.toMatch(/Internal Ring|Block [3-6]|PV15|PV16/);

  const tripsResponse = await page.request.get("/api/trips");
  expect(tripsResponse.ok()).toBeTruthy();
  const { trips } = await tripsResponse.json();
  expect(trips.length).toBeGreaterThanOrEqual(13);
  const now = Date.now();
  expect(trips.some((trip) =>
    trip.status === "NOT_STARTED" &&
    new Date(trip.departureTime).getTime() >= now &&
    new Date(trip.departureTime).getTime() <= now + 15 * 60_000,
  )).toBeTruthy();
  const trackingTrip = trips.find((trip) => trip.status === "DEPARTED");
  expect(trackingTrip).toBeTruthy();
  const locationResponse = await page.request.get(`/api/trips/${trackingTrip.id}/location`);
  expect(locationResponse.ok()).toBeTruthy();
  const { location } = await locationResponse.json();
  expect(location?.source).toBe("SIMULATED");
});

test("student creates a reserved journey and opens its Reserved Pass", async ({ browser }) => {
  const page = await browser.newPage();
  await login(page, "student6@student.tarc.edu.my");
  await openJourney(page, "TAR UMT → Wangsa Maju Section 2");
  await page.getByRole("button", { name: /Seat \d+, available/ }).first().click();
  await expect(page.getByText("Seat selected. Your seat is guaranteed after booking confirmation.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm Reserved Seat" }).click();

  await expect(page.getByText("Reserved · CONFIRMED")).toBeVisible();
  const bookingArticle = page.getByRole("article").filter({ hasText: "TAR UMT → Wangsa Maju Section 2" });
  await expect(bookingArticle).toBeVisible();

  const driver = await browser.newPage();
  await login(driver, "driver1@tarumt.edu.my");
  const tripSelect = driver.getByLabel("Assigned Trip");
  const option = tripSelect.locator("option").filter({ hasText: "TAR UMT → Wangsa Maju Section 2" });
  await tripSelect.selectOption(await option.getAttribute("value"));
  await driver.getByRole("button", { name: "Start boarding" }).click();
  await expect(driver.getByText(/Current stop: TAR UMT Gate 7 \/ East Campus/)).toBeVisible();
  await driver.close();

  await page.getByRole("button", { name: /Reserved Pass/ }).click();
  await expect(page.getByRole("dialog", { name: /Reserved Boarding Pass/ })).toBeVisible();
  await expect(page.getByText("Reserved Boarding", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy demo token" })).toBeVisible();
  await page.close();
});

test("student joins a deterministic full-journey waitlist through the UI", async ({ page }) => {
  await login(page, "student7@student.tarc.edu.my");
  await openJourney(page, "TAR UMT → PV10/PV12/PV13 corridor");
  await expect(page.getByText("No single seat is free across this complete journey.")).toBeVisible();
  await page.getByRole("button", { name: "Join Waitlist" }).click();
  await expect(page.getByText("Waitlist · WAITING")).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "TAR UMT → PV10/PV12/PV13 corridor" })).toBeVisible();
});

test("student creates a non-guaranteed Walk-in Pass through the UI", async ({ page }) => {
  await login(page, "student8@student.tarc.edu.my");
  await openJourney(page, "Jalan Genting Klang → TAR UMT");
  await page.getByRole("button", { name: "Generate Walk-in Pass" }).click();
  await expect(page.getByRole("dialog", { name: /Walk-in Boarding Pass/ })).toBeVisible();
  await expect(
    page.getByText(/Boarding not guaranteed/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy demo token" })).toBeVisible();
});

test("assigned driver starts boarding and performs a real manual boarding mutation", async ({ page }) => {
  await login(page, "driver1@tarumt.edu.my");
  const tripSelect = page.getByLabel("Assigned Trip");
  const option = tripSelect.locator("option").filter({ hasText: "TAR UMT → Wangsa Maju Section 2" });
  await tripSelect.selectOption(await option.getAttribute("value"));
  await page.getByRole("button", { name: /Manifest/ }).click();
  await expect(page.getByText("E2E Boarding Student")).toBeVisible();
  await page.getByRole("button", { name: /Trip/ }).click();
  const startBoarding = page.getByRole("button", { name: "Start boarding" });
  if (await startBoarding.isVisible()) await startBoarding.click();
  await expect(page.getByText(/Current stop: TAR UMT Gate 7 \/ East Campus/)).toBeVisible();
  await page.getByRole("button", { name: /Manifest/ }).click();
  const passenger = page.getByRole("article").filter({ hasText: "E2E Boarding Student" }).first();
  await passenger.getByRole("button", { name: "Manual board" }).click();
  await expect(page.getByText("On board")).toBeVisible();

  await page.getByRole("button", { name: /Trip/ }).click();
  await page.getByRole("button", { name: /Scan boarding pass/ }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Development / Demo fallback")).toBeVisible();
});

test("student appeal submission and admin approval complete through visible workflows", async ({ browser }) => {
  const student = await browser.newPage();
  await login(student, "student9@student.tarc.edu.my");
  await student.getByRole("button", { name: /Credit & Appeals/ }).click();
  await expect(student.getByText("85", { exact: true })).toBeVisible();
  await student.getByRole("main").getByRole("button", { name: "Submit Appeal" }).click();
  const appealDialog = student.getByRole("dialog", { name: "Appeal penalty" });
  await appealDialog.getByLabel("Explanation / Medical Reason *").fill(
    "Phase 9.5 deterministic browser appeal for an operational exception.",
  );
  await appealDialog.getByRole("button", { name: "Submit Appeal" }).click();
  await expect(student.getByText("APPEALED", { exact: true })).toBeVisible();
  await student.close();

  const admin = await browser.newPage();
  await login(admin, "admin1@admin.tarc.edu.my", "admin1");
  await admin.getByRole("button", { name: "Appeals" }).click();
  await admin.getByRole("button", { name: /E2E Appeal Student/ }).click();
  await admin.getByLabel("Review comment").fill("Approved in deterministic E2E.");
  await admin.getByRole("button", { name: /Approve and restore credit/ }).click();
  await expect(admin.getByText("Appeal approved", { exact: true })).toBeVisible();
  await expect(admin.getByRole("button", { name: "Reject appeal" })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: /Approve and restore credit/ })).toHaveCount(0);
  await admin.close();

  const result = await browser.newPage();
  await login(result, "student9@student.tarc.edu.my");
  await result.getByRole("button", { name: /Credit & Appeals/ }).click();
  await expect(result.getByText("100", { exact: true })).toBeVisible();
  await expect(result.getByText("OVERTURNED", { exact: true })).toBeVisible();
  await expect(result.getByText("Approved in deterministic E2E.")).toBeVisible();
  await result.close();
});

test("admin schedules a valid Trip and sees its generated snapshot projection", async ({ page }) => {
  await login(page, "admin1@admin.tarc.edu.my", "admin1");
  await page.getByRole("button", { name: "Timetable" }).click();
  await page.getByRole("button", { name: "Schedule Trip" }).click();
  await page.getByLabel("Route").selectOption({ label: "PV10/PV12/PV13 corridor → TAR UMT" });
  await selectOptionContaining(page.getByLabel("Bus"), "TAR-1002");
  await selectOptionContaining(page.getByLabel("Driver"), "Tan Boon Driver");
  const departure = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  const local = new Date(departure.getTime() - departure.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Departure Time").fill(local);
  await page.getByRole("button", { name: "Schedule Trip" }).click();

  const scheduled = page.getByRole("article").filter({ hasText: "PV10/PV12/PV13 corridor → TAR UMT" }).last();
  await expect(scheduled.getByText(/TAR-1002 · Tan Boon Driver/)).toBeVisible();
  await expect(scheduled.getByText(/28 seated \+ 12 standing/)).toBeVisible();
});

test("persisted GPS remains explicitly simulated and never timetable-derived", async ({ page }) => {
  await login(page, "student1@student.tarc.edu.my");
  await page.getByRole("button", { name: "Track" }).click();
  await page.getByLabel("Select Trip to Track:").selectOption({ index: 1 });
  await expect(page.getByText(/Simulated GPS \/ Prototype/)).toBeVisible();
  await expect(page.getByText(/Latest sample|No live telemetry received yet/)).toBeVisible();
});

test("only persistent Light and Dark appearance modes remain readable", async ({ page }) => {
  await login(page, "student1@student.tarc.edu.my");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkColors = await page.locator("body").evaluate((body) => ({
    background: getComputedStyle(body).backgroundColor,
    foreground: getComputedStyle(body).color,
  }));
  expect(darkColors.background).not.toBe(darkColors.foreground);

  await page.getByRole("button", { name: "Switch to Light Mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightColors = await page.locator("body").evaluate((body) => ({
    background: getComputedStyle(body).backgroundColor,
    foreground: getComputedStyle(body).color,
  }));
  expect(lightColors.background).not.toBe(lightColors.foreground);
  expect(lightColors.background).not.toBe(darkColors.background);
  await expect(page.getByText(/System|Ocean|Forest|Sunset|Midnight/)).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to Dark Mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
