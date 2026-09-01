import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const root = process.cwd();

describe("Driver operation authority boundary", () => {
  it("does not let DriverPortal choose a Trip from browser state", async () => {
    const source = await readFile(
      `${root}/src/features/boarding/ui/DriverPortal.tsx`,
      "utf8",
    );
    assert.equal(source.includes("selectedTripId"), false);
    assert.equal(source.includes("trips[0]"), false);
    assert.match(source, /fetch\("\/api\/driver\/operation"/);
    assert.match(source, /onEditTrip=\{null\}/);
  });

  it("keeps Bus and Route free of permanent Driver ownership", async () => {
    const schema = await readFile(`${root}/prisma/schema.prisma`, "utf8");
    const bus = schema.match(/model Bus \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const route = schema.match(/model Route \{([\s\S]*?)\n\}/)?.[1] ?? "";
    assert.equal(/driver|routeId|lineId/i.test(bus), false);
    assert.equal(/driver/i.test(route), false);
  });

  it("resolves from the authenticated Driver without accepting a Trip ID", async () => {
    const route = await readFile(
      `${root}/app/api/driver/operation/route.ts`,
      "utf8",
    );
    assert.match(route, /getUserFromToken\(\)/);
    assert.match(route, /getDriverOperation\(\{ userId: user\.userId, role: user\.role \}\)/);
    assert.equal(route.includes("tripId"), false);
  });
});
