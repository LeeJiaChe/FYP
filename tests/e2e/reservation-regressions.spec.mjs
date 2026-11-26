import { expect, test as base } from "@playwright/test";

const studentEmail = (number) => `student${number}@student.tarc.edu.my`;
let nextClient = 1;

const test = base.extend({
  session: async ({ browser, baseURL }, provideSession) => {
    const contexts = [];
    await provideSession(async (email, password = "password123", timezoneId = "Asia/Kuala_Lumpur") => {
      const context = await browser.newContext({ baseURL, timezoneId });
      contexts.push(context);
      const response = await context.request.post("/api/auth/login", {
        headers: { origin: baseURL, "x-fyp-client-ip": `192.0.2.${nextClient++}` },
        data: { emailOrStudentId: email, password },
      });
      expect(response.status()).toBe(200);
      return context;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

async function createRecord(context, baseURL, path, data) {
  const response = await context.request.post(path, { headers: { origin: baseURL }, data });
  expect(response.status()).toBe(201);
  return response.json();
}

async function schedule(admin, baseURL, marker, departureTime, driverId) {
  const { routes } = await (await admin.request.get("/api/admin/routes")).json();
  const route = routes.find(({ name }) => name === "PV10/PV12/PV13 corridor → TAR UMT");
  const plateNumber = `[E2E_TEST] ${marker}`;
  const { bus } = await createRecord(admin, baseURL, "/api/admin/buses", {
    plateNumber, seatedCapacity: 1, standingCapacity: 0,
  });
  const { trip } = await createRecord(admin, baseURL, "/api/trips", {
    routeId: route.id, busId: bus.id, departureTime, driverId,
  });
  const result = await admin.request.get(`/api/trips?routeId=${route.id}`);
  expect(result.ok()).toBeTruthy();
  const { trips } = await result.json();
  return { ...trips.find(({ id }) => id === trip.id), plateNumber };
}

function journey(trip, fromIndex = 0) {
  return {
    tripId: trip.id,
    boardingTripStopId: trip.tripStops[fromIndex].id,
    dropOffTripStopId: trip.tripStops.at(-1).id,
  };
}

async function reserve(context, baseURL, trip) {
  const selection = journey(trip);
  const result = await context.request.get(`/api/bookings/availability?${new URLSearchParams(selection)}`);
  expect(result.ok()).toBeTruthy();
  const { availability } = await result.json();
  return createRecord(context, baseURL, "/api/bookings", { ...selection, tripSeatId: availability.seats[0].id });
}

async function openSubscribedStudent(context, view, tripId) {
  const page = await context.newPage();
  let subscribed = false;
  let refreshed = false;
  page.on("response", (response) => {
    if (response.ok() && response.url().endsWith("/api/realtime/subscription") &&
        response.request().postDataJSON()?.tripId === tripId) subscribed = true;
    if (subscribed && response.ok() && response.url().endsWith("/api/bookings/mine")) refreshed = true;
  });
  await page.goto(`/student?view=${view}`);
  await expect.poll(() => refreshed).toBe(true);
  return page;
}

function browserProblems(page) {
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.name + ": " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || /hydrat/i.test(message.text())) problems.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText;
    if (reason !== "net::ERR_ABORTED") problems.push(`${reason} ${new URL(request.url()).pathname}`);
  });
  return problems;
}

test("cancellation promotes a waiting student and updates the next student's rank through realtime", async ({ session, baseURL }) => {
  const [admin, holder, first, second] = await Promise.all([
    session("admin1@admin.tarc.edu.my", "admin1"),
    session(studentEmail(6)),
    session(studentEmail(7)),
    session(studentEmail(8)),
  ]);
  const trip = await schedule(admin, baseURL, "WAITLIST", new Date(Date.now() + 72 * 3600_000).toISOString());
  await reserve(holder, baseURL, trip);
  await createRecord(first, baseURL, "/api/waitlist", journey(trip));
  await createRecord(second, baseURL, "/api/waitlist", journey(trip));

  const [holderPage, firstPage, secondPage] = await Promise.all([
    openSubscribedStudent(holder, "journeys", trip.id),
    openSubscribedStudent(first, "journeys", trip.id),
    openSubscribedStudent(second, "journeys", trip.id),
  ]);
  const problems = [holderPage, firstPage, secondPage].map(browserProblems);
  await expect(firstPage.getByText("Queue position: #1 for this trip")).toBeVisible();
  await expect(secondPage.getByText("Queue position: #2 for this trip")).toBeVisible();
  await expect(secondPage.getByText(/earliest request they can serve for the complete journey/)).toBeVisible();

  await holderPage.getByRole("button", { name: "Cancel", exact: true }).click();
  await holderPage.getByRole("button", { name: "Yes, Cancel Booking" }).click();
  await expect(holderPage.getByText("Reserved · CANCELLED")).toBeVisible();
  await expect(firstPage.getByText("Waitlist · PROMOTED")).toBeVisible();
  await expect(firstPage.getByText("Reserved · CONFIRMED")).toBeVisible();
  await expect(secondPage.getByText("Waitlist · WAITING")).toBeVisible();
  await expect(secondPage.getByText("Queue position: #1 for this trip")).toBeVisible();
  expect(problems.flat()).toEqual([]);
});

test("a post-midnight intermediate departure is discoverable and uses MYT in the seat dialog", async ({ session, baseURL }) => {
  const admin = await session("admin1@admin.tarc.edu.my", "admin1");
  const day = new Date(Date.now() + 4 * 24 * 3600_000).toISOString().slice(0, 10);
  const laterDay = new Date(Date.parse(day) + 24 * 3600_000).toISOString().slice(0, 10);
  const trip = await schedule(admin, baseURL, "MIDNIGHT", `${day}T23:58:00+08:00`);
  const boardingStop = trip.tripStops[1];
  const expected = new Date(Date.parse(boardingStop.plannedDeparture) + 8 * 3600_000).toISOString();
  expect(expected.slice(0, 10)).toBe(laterDay);

  for (const timezone of ["Asia/Kuala_Lumpur", "UTC"]) {
    const context = await session(studentEmail(6), "password123", timezone);
    const page = await context.newPage();
    const problems = browserProblems(page);
    await page.goto("/student?view=book");
    await page.getByLabel("From").selectOption({ label: boardingStop.stopName });
    await page.getByRole("combobox", { name: /Where are you going/ }).selectOption({ label: trip.tripStops.at(-1).stopName });
    await page.getByLabel("Date").selectOption(laterDay);
    const departure = page.getByRole("article").filter({ hasText: trip.plateNumber });
    await expect(departure.locator("time")).toHaveText(expected.slice(11, 16));
    await departure.getByRole("button", { name: "Check seats" }).click();
    const modal = page.getByRole("dialog", { name: "Choose your seat" });
    await expect(modal).toContainText(`${expected.slice(11, 16)} MYT`);
    await expect(modal.getByRole("button", { name: "Seat 1, Available" })).toBeEnabled();
    expect(problems).toEqual([]);
  }
});

test("a driver's stop departure refreshes the affected student's credit and penalty in place", async ({ session, baseURL }) => {
  const admin = await session("admin1@admin.tarc.edu.my", "admin1");
  const student = await session(studentEmail(6));
  const driverEmail = "e2e-credit-driver@tarumt.edu.my";
  const password = "FixtureOnly123!";
  const { driver } = await createRecord(admin, baseURL, "/api/admin/drivers", {
    name: "[E2E_TEST] Credit Driver", email: driverEmail, password,
  });
  const trip = await schedule(admin, baseURL, "CREDIT", new Date(Date.now() + 10 * 60_000).toISOString(), driver.id);
  await reserve(student, baseURL, trip);

  const driverContext = await session(driverEmail, password);
  const studentPage = await openSubscribedStudent(student, "account", trip.id);
  const driverPage = await driverContext.newPage();
  const problems = [studentPage, driverPage].map(browserProblems);
  await expect(studentPage.getByText(/^100\s*\/100$/)).toBeVisible();
  await driverPage.goto("/driver");
  await driverPage.getByRole("button", { name: /^Start boarding\b/ }).click();
  await driverPage.getByRole("button", { name: "Depart stop", exact: true }).click();
  await driverPage.getByRole("button", { name: "Confirm progress" }).click();
  await expect(studentPage.getByText(/^85\s*\/100$/)).toBeVisible();
  await expect(studentPage.getByText("-15 pts", { exact: true })).toBeVisible();
  const response = await student.request.get("/api/penalties/mine");
  expect((await response.json()).penalties).toHaveLength(1);
  expect(problems.flat()).toEqual([]);
});

test("a long route and bus label fit the 320px Admin dashboard", async ({ session, baseURL }) => {
  const admin = await session("admin1@admin.tarc.edu.my", "admin1");
  const trip = await schedule(admin, baseURL, "EXTRALONG123", new Date(Date.now() + 5 * 60_000).toISOString());
  const page = await admin.newPage();
  const problems = browserProblems(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/admin");
  const upcoming = page.getByRole("article").filter({ hasText: trip.plateNumber });
  await expect(upcoming).toBeVisible();
  await expect(upcoming.getByText(trip.routeName)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(problems).toEqual([]);
});

test("My journeys distinguishes a pending request, a failed request, and a successful empty result", async ({ session }) => {
  const student = await session(studentEmail(8));
  const page = await student.newPage();
  let allowResponse;
  const delayedResponse = new Promise((resolve) => { allowResponse = resolve; });
  let shouldFail = true;
  await page.route("**/api/bookings/mine", async (route) => {
    if (shouldFail) {
      await delayedResponse;
      await route.fulfill({ status: 503, json: { error: "Fixture request failure" } });
      return;
    }
    await route.fulfill({ json: { bookings: [], waitlist: [] } });
  });
  await page.route("**/api/walk-ins", (route) => route.fulfill({ json: { intents: [] } }));
  await page.goto("/student?view=journeys");
  try {
    await expect(page.getByText("Loading journeys…")).toBeVisible();
    await expect(page.getByText("No journeys yet")).toHaveCount(0);
  } finally {
    allowResponse();
  }
  await expect(page.getByText(/Some journey details are unavailable/)).toBeVisible();
  await expect(page.getByText("No journeys yet")).toHaveCount(0);
  shouldFail = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("No journeys yet")).toBeVisible();
  await expect(page.getByText(/Some journey details are unavailable/)).toHaveCount(0);
});
