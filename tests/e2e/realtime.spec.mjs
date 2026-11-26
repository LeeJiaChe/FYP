import { expect, test } from "@playwright/test";

const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;

async function login(context, baseURL, email, password) {
  const response = await context.request.post("/api/auth/login", {
    headers: { origin: baseURL },
    data: { emailOrStudentId: email, password },
  });
  expect(response.ok()).toBeTruthy();
}

async function subscribe(context, baseURL, tripId) {
  return context.request.post("/api/realtime/subscription", {
    headers: { origin: baseURL }, data: { tripId },
  });
}

async function connect(page, token) {
  await page.addScriptTag({ url: `${realtimeUrl}/socket.io/socket.io.js` });
  await page.evaluate(({ url, token }) => new Promise((resolve, reject) => {
    window.received = [];
    window.fixtureSocket = window.io(url, { auth: { token }, transports: ["websocket"] });
    window.fixtureSocket.onAny((event, payload) => window.received.push({ event, payload }));
    window.fixtureSocket.once("connect", resolve);
    window.fixtureSocket.once("connect_error", (error) => reject(new Error(error.message)));
  }), { url: realtimeUrl, token });
}

test("independent browser sessions receive only authorized Trip invalidations and refetch telemetry after reconnect", async ({ browser, baseURL }) => {
  const student = await browser.newContext({ baseURL });
  const admin = await browser.newContext({ baseURL });
  const driver = await browser.newContext({ baseURL });
  try {
    await login(student, baseURL, "student10@student.tarc.edu.my", "password123");
    await login(admin, baseURL, "admin1@admin.tarc.edu.my", "admin1");
    await login(driver, baseURL, "driver2@tarumt.edu.my", "password123");
    const { trips } = await (await admin.request.get("/api/trips")).json();
    const active = trips.find((trip) => trip.status === "DEPARTED");
    const other = trips.find((trip) => trip.status === "NOT_STARTED");
    expect(active).toBeTruthy();
    expect(other).toBeTruthy();

    const { trips: assigned } = await (await driver.request.get("/api/trips")).json();
    const unassigned = trips.find((trip) => !assigned.some(({ id }) => trip.id === id));
    expect(unassigned).toBeTruthy();
    expect((await subscribe(driver, baseURL, unassigned.id)).status()).toBe(403);

    const first = await student.newPage();
    const second = await admin.newPage();
    await Promise.all([first.goto("/student"), second.goto("/admin")]);
    const studentScope = await subscribe(student, baseURL, active.id);
    const adminScope = await subscribe(admin, baseURL, other.id);
    expect(studentScope.ok()).toBeTruthy();
    expect(adminScope.ok()).toBeTruthy();
    const { token: studentToken } = await studentScope.json();
    const { token: adminToken } = await adminScope.json();
    await Promise.all([connect(first, studentToken), connect(second, adminToken)]);

    const simulate = async () => {
      const response = await admin.request.post("/api/location/simulate", {
        headers: { "x-service-secret": process.env.REALTIME_SERVICE_SECRET },
        data: {},
      });
      expect(response.ok()).toBeTruthy();
    };
    await simulate();
    await expect.poll(() => first.evaluate(() => window.received.some(({ event }) => event === "location.changed"))).toBe(true);
    const locationEvents = await first.evaluate(() => window.received.filter(({ event }) => event === "location.changed"));
    for (const { payload } of locationEvents) {
      expect(payload.entityId).toBe(active.id);
      expect(Object.keys(payload).sort()).toEqual(["changedAt", "entityId", "reason"]);
    }
    expect(await second.evaluate(() => window.received.filter(({ event }) => event === "location.changed"))).toEqual([]);

    const readTelemetry = async () => {
      const response = await student.request.get(`/api/trips/${active.id}/location`);
      expect(response.ok()).toBeTruthy();
      return (await response.json()).location;
    };
    const before = await readTelemetry();
    await first.evaluate(() => window.fixtureSocket.disconnect());
    await simulate();
    const after = await readTelemetry();
    expect(after.source).toBe("SIMULATED");
    expect(Date.parse(after.recordedAt)).toBeGreaterThan(Date.parse(before.recordedAt));

    const freshScope = await subscribe(student, baseURL, active.id);
    expect(freshScope.ok()).toBeTruthy();
    const { token: freshToken } = await freshScope.json();
    await first.evaluate((token) => new Promise((resolve, reject) => {
      const socket = window.fixtureSocket;
      socket.auth = { token };
      socket.once("connect", resolve);
      socket.once("connect_error", (error) => reject(new Error(error.message)));
      socket.connect();
    }), freshToken);
    expect((await readTelemetry()).recordedAt).toBe(after.recordedAt);
  } finally {
    await Promise.all([student.close(), admin.close(), driver.close()]);
  }
});
