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

test("student creates a reserved journey and opens its Reserved Pass", async ({ page }) => {
  await login(page, "student6@student.tarc.edu.my");
  await openJourney(page, "Demo: Danau Kota → TAR UMT");
  await page.getByRole("button", { name: /Seat 1, available/ }).click();
  await expect(page.getByText("Seat selected. Your seat is guaranteed after booking confirmation.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm Reserved Seat" }).click();

  await expect(page.getByText("RESERVED · CONFIRMED")).toBeVisible();
  const bookingArticle = page.getByRole("article").filter({ hasText: "Demo: Danau Kota → TAR UMT" });
  await expect(
    bookingArticle.getByRole("heading", { name: "Demo: Danau Kota → TAR UMT" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Reserved Pass/ }).click();
  await expect(page.getByRole("dialog", { name: /Reserved Boarding Pass/ })).toBeVisible();
  await expect(page.getByText("Reserved Boarding", { exact: true })).toBeVisible();
});

test("student joins a deterministic full-journey waitlist through the UI", async ({ page }) => {
  await login(page, "student7@student.tarc.edu.my");
  await openJourney(page, "Demo: TAR UMT → Setapak Central");
  await expect(page.getByText("No single seat is free across this complete journey.")).toBeVisible();
  await page.getByRole("button", { name: "Join Waitlist" }).click();
  await expect(page.getByText("WAITLIST · WAITING")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo: TAR UMT → Setapak Central" })).toBeVisible();
});

test("student creates a non-guaranteed Walk-in Pass through the UI", async ({ page }) => {
  await login(page, "student8@student.tarc.edu.my");
  await openJourney(page, "Demo: Danau Kota → TAR UMT");
  await page.getByRole("button", { name: "Generate Walk-in Pass" }).click();
  await expect(page.getByRole("dialog", { name: /Walk-in Boarding Pass/ })).toBeVisible();
  await expect(
    page.getByText("This pass does not guarantee boarding. Standing capacity is checked when scanned."),
  ).toBeVisible();
});

test("assigned driver starts boarding and performs a real manual boarding mutation", async ({ page }) => {
  await login(page, "driver1@tarumt.edu.my");
  const tripSelect = page.getByLabel("Assigned Trip");
  const option = tripSelect.locator("option").filter({ hasText: "Demo: TAR UMT → Danau Kota" });
  await tripSelect.selectOption(await option.getAttribute("value"));
  await expect(page.getByText("E2E Boarding Student")).toBeVisible();
  await page.getByRole("button", { name: "Start boarding" }).click();
  await expect(page.getByText(/Current stop: TAR UMT Main Gate/)).toBeVisible();
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
  await page.getByLabel("Route").selectOption({ label: "Demo: Setapak Central → TAR UMT" });
  await selectOptionContaining(page.getByLabel("Bus"), "TAR-1002");
  await selectOptionContaining(page.getByLabel("Driver"), "Tan Boon Driver");
  const departure = new Date(Date.now() + 72 * 60 * 60 * 1_000);
  const local = new Date(departure.getTime() - departure.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Departure Time").fill(local);
  await page.getByRole("button", { name: "Schedule Trip" }).click();

  const scheduled = page
    .getByRole("heading", { name: "Demo: Setapak Central → TAR UMT" })
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
