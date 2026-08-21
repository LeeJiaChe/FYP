import { test, expect } from "@playwright/test";

async function login(page, identity, password = "password123") {
  await page.goto("/login");
  await page.getByLabel("Email or Student ID").fill(identity);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(?:student|driver|admin)$/);
}

test("student reservation flow and Reserved Pass are journey truthful", async ({ page }) => {
  await login(page, "student1@student.tarc.edu.my");
  await expect(page.getByRole("heading", { name: "Student Shuttle Portal" })).toBeVisible();
  await page.getByRole("button", { name: /Choose From and To/ }).first().click();
  await expect(page.getByText("From → To → Date → Departure → Seat")).toBeVisible();
  await expect(page.getByText("Select boarding and drop-off stops:")).toBeVisible();
  await page.getByRole("button", { name: /Next: Pick Date/ }).click();
  await page.getByRole("button", { name: /Next: Choose Departure/ }).click();
  await expect(page.getByText(/Departure & Seat/)).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /My Bookings/ }).click();
  await expect(page.getByText(/RESERVED · CONFIRMED/).first()).toBeVisible();
  await expect(page.getByText(/Seat 1/).first()).toBeVisible();
  await page.getByRole("button", { name: /Reserved Pass/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Reserved Boarding Pass/ })).toBeVisible();
  await expect(page.getByText("Reserved Boarding")).toBeVisible();
});

test("waitlist, walk-in, penalty and appeal states use approved language", async ({ browser }) => {
  const waiter = await browser.newPage();
  await login(waiter, "student5@student.tarc.edu.my");
  await waiter.getByRole("tab", { name: /My Bookings/ }).click();
  await expect(waiter.getByText(/WAITLIST · WAITING/)).toBeVisible();
  await waiter.close();

  const walkIn = await browser.newPage();
  await login(walkIn, "student3@student.tarc.edu.my");
  await walkIn.getByRole("tab", { name: /My Bookings/ }).click();
  await expect(walkIn.getByText(/WALK-IN · PENDING/)).toBeVisible();
  await expect(walkIn.getByText("This pass does not guarantee boarding. Standing capacity is checked when scanned.")).toBeVisible();
  await walkIn.close();

  const penalized = await browser.newPage();
  await login(penalized, "student2@student.tarc.edu.my");
  await penalized.getByRole("tab", { name: /Penalties & Appeals/ }).click();
  await expect(penalized.getByText("85", { exact: true })).toBeVisible();
  await expect(penalized.getByText("APPEALED", { exact: true })).toBeVisible();
  await expect(penalized.getByText(/medical emergency/)).toBeVisible();
  await penalized.close();
});

test("driver keeps camera scanning primary and demo fallback explicit", async ({ page }) => {
  await login(page, "driver1@tarumt.edu.my");
  await expect(page.getByRole("heading", { name: "Boarding, alighting and Trip progress" })).toBeVisible();
  await expect(page.getByLabel("Assigned Trip")).toBeVisible();
  await expect(page.getByText(/Current stop:|Between stops \/ not started/).first()).toBeVisible();
  await page.getByRole("button", { name: /Scan Boarding/ }).click();
  await expect(page.getByRole("dialog", { name: /Boarding Pass Scanner/ })).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Development / Demo fallback")).toBeVisible();
});

test("admin exposes fleet, scheduling, monitoring, analytics and appeals", async ({ page }) => {
  await login(page, "admin1@admin.tarc.edu.my", "admin1");
  await expect(page.getByRole("heading", { name: "Shuttle Administration" })).toBeVisible();
  for (const name of ["Dashboard / Live", "Stops", "Routes", "Buses", "Timetable", "Drivers", "Appeals", "Analytics"]) {
    await expect(page.getByRole("tab", { name: new RegExp(name.replace("/", "\\/")) })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Timetable" }).click();
  await page.getByRole("button", { name: /Schedule New Trip/ }).click();
  await expect(page.getByRole("dialog", { name: /Schedule Trip/ })).toBeVisible();
  await expect(page.getByLabel("Route")).toBeVisible();
  await expect(page.getByLabel("Bus")).toBeVisible();
  await expect(page.getByLabel("Driver")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Appeals/ }).click();
  await expect(page.getByText(/medical emergency/)).toBeVisible();
});

test("persisted GPS is explicitly simulated and has an honest empty or freshness state", async ({ page }) => {
  await login(page, "student1@student.tarc.edu.my");
  await page.getByRole("tab", { name: /Track Bus/ }).click();
  await page.getByLabel("Select Trip to Track:").selectOption({ index: 1 });
  await expect(page.getByText(/Simulated GPS \/ Prototype/)).toBeVisible();
  await expect(page.getByText(/Latest sample|No live telemetry received yet/)).toBeVisible();
});
