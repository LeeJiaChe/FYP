import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { verifyTestDatabaseEnvironment } from "../../scripts/verify-test-database";

describe("dedicated PostgreSQL integration boundary", () => {
  it("connects to the explicitly verified test database", async () => {
    const verified = await verifyTestDatabaseEnvironment(process.env);
    const prisma = new PrismaClient({ datasourceUrl: verified.url });
    try {
      const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
        SELECT current_database() AS database_name
      `;
      assert.equal(rows[0]?.database_name, verified.databaseName);
      assert.match(rows[0]?.database_name ?? "", /(?:^|_)test$/);
    } finally {
      await prisma.$disconnect();
    }
  });
});
