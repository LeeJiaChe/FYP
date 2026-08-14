import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyTestDatabaseEnvironment } from "../../scripts/verify-test-database";

const confirmation = "FYP_BUS_INTEGRATION";

describe("integration database safety", () => {
  it("never falls back to the development database", () => {
    assert.throws(
      () =>
        verifyTestDatabaseEnvironment({
          DATABASE_URL: "postgresql://localhost/fyp_bus",
          TEST_DATABASE_CONFIRM: confirmation,
        }),
      /TEST_DATABASE_URL is required/,
    );
  });

  it("rejects SQLite and non-test database names", () => {
    assert.throws(
      () =>
        verifyTestDatabaseEnvironment({
          TEST_DATABASE_URL: "file:./test.db",
          TEST_DATABASE_CONFIRM: confirmation,
        }),
      /must use PostgreSQL/,
    );
    assert.throws(
      () =>
        verifyTestDatabaseEnvironment({
          TEST_DATABASE_URL: "postgresql://localhost/fyp_bus",
          TEST_DATABASE_CONFIRM: confirmation,
        }),
      /must end in _test/,
    );
  });

  it("rejects a test URL equal to DATABASE_URL", () => {
    const shared = "postgresql://localhost/fyp_bus_test";
    assert.throws(
      () =>
        verifyTestDatabaseEnvironment({
          DATABASE_URL: shared,
          TEST_DATABASE_URL: shared,
          TEST_DATABASE_CONFIRM: confirmation,
        }),
      /must not equal/,
    );
  });

  it("requires an explicit destructive-test acknowledgement", () => {
    assert.throws(
      () =>
        verifyTestDatabaseEnvironment({
          TEST_DATABASE_URL: "postgresql://localhost/fyp_bus_test",
        }),
      /TEST_DATABASE_CONFIRM/,
    );
  });
});
