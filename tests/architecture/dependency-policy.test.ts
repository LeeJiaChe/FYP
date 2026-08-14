import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";

import {
  inspectArchitectureV2Source,
  inspectDependencyPolicy,
} from "./support/dependency-policy";

function rules(file: string, source: string): string[] {
  return inspectDependencyPolicy(file, source).map((violation) => violation.rule);
}

describe("Architecture v2 dependency policy", () => {
  it("rejects Prisma imports from domain and UI modules", () => {
    assert.deepEqual(
      rules(
        "src/features/bookings/domain/availability.ts",
        'import { PrismaClient } from "@prisma/client";',
      ),
      ["no-prisma-in-domain-or-ui"],
    );
    assert.deepEqual(
      rules(
        "src/features/bookings/ui/SeatPicker.tsx",
        'import prisma from "@/shared/db";',
      ),
      ["no-prisma-in-domain-or-ui"],
    );
  });

  it("rejects cross-feature internal deep imports but permits public facades", () => {
    assert.deepEqual(
      rules(
        "src/features/boarding/application/board.ts",
        'import { reserve } from "@/features/bookings/domain/reserve";',
      ),
      ["no-cross-feature-deep-import"],
    );
    assert.deepEqual(
      rules(
        "src/features/boarding/application/board.ts",
        'import { reserve } from "@/features/bookings/server";',
      ),
      [],
    );
    assert.deepEqual(
      rules(
        "src/features/boarding/application/board.ts",
        'import { reserve } from "../../bookings/domain/reserve";',
      ),
      ["no-cross-feature-deep-import"],
    );
  });

  it("rejects server-only dependencies from Client Components", () => {
    assert.deepEqual(
      rules(
        "src/features/location/ui/LiveMap.tsx",
        `'use client';\nimport { latest } from "@/features/location/server";`,
      ),
      ["no-server-import-in-client"],
    );
  });

  it("rejects persistence and business-layer imports in Route Handlers", () => {
    const violations = rules(
      "src/app/api/bookings/route.ts",
      'import prisma from "@/shared/db";\nexport async function POST() { return prisma.booking.update({}); }',
    );

    assert.deepEqual(violations, [
      "route-handler-is-transport-only",
      "route-handler-is-transport-only",
      "route-handler-is-transport-only",
    ]);
  });

  it("requires mutating Route Handlers to delegate to a server facade", () => {
    assert.deepEqual(
      rules(
        "src/app/api/bookings/route.ts",
        "export async function POST() { return Response.json({ ok: true }); }",
      ),
      ["route-handler-is-transport-only"],
    );
  });

  it("accepts a Route Handler that delegates to one server facade", () => {
    assert.deepEqual(
      rules(
        "src/app/api/bookings/route.ts",
        'import { createBooking } from "@/features/bookings/server";\nexport async function POST(request: Request) { return createBooking(request); }',
      ),
      [],
    );
  });

  it("enforces the same policy over all Architecture v2 source in src", async () => {
    const violations = await inspectArchitectureV2Source(
      path.resolve(import.meta.dirname, "../.."),
    );

    assert.deepEqual(violations, []);
  });
});
