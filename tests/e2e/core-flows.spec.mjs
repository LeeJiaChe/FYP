import { test, expect } from "@playwright/test";

async function login(page, identity, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill(identity);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(?:student|driver|admin)$/);
}

async function openJourney(page, routeName) {
  const routeCard = page
    .getByRole("heading", { name: routeName })
    .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' glass-card ')][1]");
  await routeCard.getByRole("button", { name: /Choose From and To/ }).click();
  await expect(page.getByText("From → To → Date → Departure → Seat")).toBeVisible();
  await page.getByRole("button", { name: /Next: Pick Date/ }).click();
  await page.getByRole("button", { name: /Next: Choose Departure/ }).click();
  await page.getByRole("button", { name: /Check Seats/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Select Seat/ })).toBeVisible();
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

  await expect(page.getByText("RESERVED · CONFIRMED")).toBeVisible();
  const bookingArticle = page.getByRole("article").filter({ hasText: "TAR UMT → Wangsa Maju Section 2" });
  await expect(
    bookingArticle.getByRole("heading", { name: "TAR UMT → Wangsa Maju Section 2" }),
  ).toBeVisible();

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
  await expect(page.getByText("WAITLIST · WAITING")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TAR UMT → PV10/PV12/PV13 corridor" })).toBeVisible();
});

test("student creates a non-guaranteed Walk-in Pass through the UI", async ({ page }) => {
  await login(page, "student8@student.tarc.edu.my");
  await openJourney(page, "Jalan Genting Klang → TAR UMT");
  await page.getByRole("button", { name: "Generate Walk-in Pass" }).click();
  await expect(page.getByRole("dialog", { name: /Walk-in Boarding Pass/ })).toBeVisible();
  await expect(
    page.getByText("This pass does not guarantee boarding. Standing capacity is checked when scanned."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy demo token" })).toBeVisible();
});

test("assigned driver starts boarding and performs a real manual boarding mutation", async ({ page }) => {
  await login(page, "driver1@tarumt.edu.my");
  const tripSelect = page.getByLabel("Assigned Trip");
  const option = tripSelect.locator("option").filter({ hasText: "TAR UMT → Wangsa Maju Section 2" });
  await tripSelect.selectOption(await option.getAttribute("value"));
  await expect(page.getByText("E2E Boarding Student")).toBeVisible();
  const startBoarding = page.getByRole("button", { name: "Start boarding" });
  if (await startBoarding.isVisible()) await startBoarding.click();
  await expect(page.getByText(/Current stop: TAR UMT Gate 7 \/ East Campus/)).toBeVisible();
  const passenger = page
    .getByText(/E2E Boarding Student · RESERVED/)
    .locator("xpath=ancestor::div[contains(@class, 'bg-slate-900')][1]");
  await passenger.getByRole("button", { name: "Manual board" }).click();
  await expect(passenger.getByText("Boarded")).toBeVisible();

  await page.getByRole("button", { name: /Scan Boarding/ }).click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Development / Demo fallback")).toBeVisible();
});

test("student appeal submission and admin approval complete through visible workflows", async ({ browser }) => {
  const student = await browser.newPage();
  await login(student, "student9@student.tarc.edu.my");
  await student.getByRole("tab", { name: /Penalties & Appeals/ }).click();
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
  await admin.getByRole("tab", { name: "Appeals" }).click();
  const appealCard = admin
    .getByText("E2E Appeal Student")
    .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' glass-card ')][1]");
  await appealCard.getByPlaceholder("Admin review comment / note...").fill("Approved in deterministic E2E.");
  await appealCard.getByRole("button", { name: /Approve/ }).click();
  await expect(appealCard.getByText("Status: APPROVED")).toBeVisible();
  await admin.close();

  const result = await browser.newPage();
  await login(result, "student9@student.tarc.edu.my");
  await result.getByRole("tab", { name: /Penalties & Appeals/ }).click();
  await expect(result.getByText("100", { exact: true })).toBeVisible();
  await expect(result.getByText("OVERTURNED", { exact: true })).toBeVisible();
  await expect(result.getByText("Approved in deterministic E2E.")).toBeVisible();
  await result.close();
});

test("admin schedules a valid Trip and sees its generated snapshot projection", async ({ page }) => {
  await login(page, "admin1@admin.tarc.edu.my", "admin1");
  await page.getByRole("tab", { name: "Timetable" }).click();
  await page.getByRole("button", { name: "Schedule New Trip" }).click();
  await page.getByLabel("Route").selectOption({ label: "PV10/PV12/PV13 corridor → TAR UMT" });
  await selectOptionContaining(page.getByLabel("Bus"), "TAR-1002");
  await selectOptionContaining(page.getByLabel("Driver"), "Tan Boon Driver");
  const departure = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  const local = new Date(departure.getTime() - departure.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Departure Time").fill(local);
  await page.getByRole("button", { name: "Schedule Trip" }).click();

  const scheduled = page
    .getByRole("heading", { name: "PV10/PV12/PV13 corridor → TAR UMT" })
    .last()
    .locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' glass-card ')][1]");
  await expect(scheduled.getByText("TAR-1002", { exact: true })).toBeVisible();
  await expect(scheduled.getByText(/Driver: Tan Boon Driver/)).toBeVisible();
  await expect(scheduled.getByText(/Snapshot: 28 seated \+ 12 standing/)).toBeVisible();
});

test("persisted GPS remains explicitly simulated and never timetable-derived", async ({ page }) => {
  await login(page, "student1@student.tarc.edu.my");
  await page.getByRole("tab", { name: /Track Bus/ }).click();
  await page.getByLabel("Select Trip to Track:").selectOption({ index: 1 });
  await expect(page.getByText(/Simulated GPS \/ Prototype/)).toBeVisible();
  await expect(page.getByText(/Latest sample|No live telemetry received yet/)).toBeVisible();
});

test("system, light, and dark appearance preferences remain readable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await login(page, "student1@student.tarc.edu.my");
  await page.evaluate(() => localStorage.setItem("fyp-theme", "system"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightColors = await page.locator("body").evaluate((body) => ({
    background: getComputedStyle(body).backgroundColor,
    foreground: getComputedStyle(body).color,
  }));
  expect(lightColors.background).not.toBe(lightColors.foreground);

  await page.evaluate(() => localStorage.setItem("fyp-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkColors = await page.locator("body").evaluate((body) => ({
    background: getComputedStyle(body).backgroundColor,
    foreground: getComputedStyle(body).color,
  }));
  expect(darkColors.background).not.toBe(darkColors.foreground);
  expect(darkColors.background).not.toBe(lightColors.background);
});
