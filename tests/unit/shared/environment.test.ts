import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseServerEnvironment,
  ServerEnvironmentValidationError,
} from "../../../src/shared/config/server-environment";

const validEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:postgres@database:5432/fyp_bus",
  JWT_SECRET: "session-secret-000000000000000000000001",
  QR_SECRET: "qr-signing-secret-0000000000000000000002",
  REALTIME_URL: "https://realtime.example.test/",
  REALTIME_SERVICE_SECRET: "realtime-secret-0000000000000000000003",
} as const;

describe("server environment validation", () => {
  it("separates database, session, QR, realtime, and test concerns", () => {
    const environment = parseServerEnvironment(validEnvironment);

    assert.equal(environment.runtime, "production");
    assert.equal(environment.database.url, validEnvironment.DATABASE_URL);
    assert.equal(
      environment.session.signingSecret,
      validEnvironment.JWT_SECRET,
    );
    assert.equal(environment.qr.signingSecret, validEnvironment.QR_SECRET);
    assert.equal(
      environment.realtime.serviceUrl,
      "https://realtime.example.test",
    );
    assert.equal(environment.integrationTest.confirmed, false);
    assert.equal(environment.integrationTest.databaseUrl, undefined);
    assert.equal(environment.googleTrafficEta.enabled, false);
    assert.equal(environment.googleTrafficEta.apiKey, "");
    assert.equal(environment.geminiOperations.enabled, false);
    assert.equal(environment.geminiOperations.apiKey, "");
    assert.equal(environment.geminiOperations.model, "gemini-3.8-flash");
  });

  it("keeps Gemini server-only, opt-in, and explicitly modelled", () => {
    const environment = parseServerEnvironment({
      ...validEnvironment,
      GEMINI_OPERATIONS_ASSISTANT_ENABLED: "true",
      GEMINI_API_KEY: "server-only-gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    });
    assert.equal(environment.geminiOperations.enabled, true);
    assert.equal(environment.geminiOperations.apiKey, "server-only-gemini-key");
    assert.equal(environment.geminiOperations.model, "gemini-3.8-flash");
  });

  it("parses Google traffic ETA configuration when enabled", () => {
    const environment = parseServerEnvironment({
      ...validEnvironment,
      GOOGLE_TRAFFIC_ETA_ENABLED: "true",
      GOOGLE_MAPS_ROUTES_API_KEY: "secret-routes-key",
    });

    assert.equal(environment.googleTrafficEta.enabled, true);
    assert.equal(environment.googleTrafficEta.apiKey, "secret-routes-key");
  });

  it("fails clearly without leaking secret values", () => {
    const leakedCandidate = "short-secret-value";
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          JWT_SECRET: leakedCandidate,
        }),
      (error) => {
        assert.ok(error instanceof ServerEnvironmentValidationError);
        assert.match(error.message, /JWT_SECRET/);
        assert.doesNotMatch(error.message, new RegExp(leakedCandidate));
        return true;
      },
    );
  });

  it("requires PostgreSQL and three distinct secrets", () => {
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          DATABASE_URL: "file:./development.db",
        }),
      /DATABASE_URL: must be a PostgreSQL URL/,
    );
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          QR_SECRET: validEnvironment.JWT_SECRET,
        }),
      /must be distinct/,
    );
  });

  it("keeps integration settings opt-in and fail-closed", () => {
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          TEST_DATABASE_URL:
            "postgresql://postgres:postgres@database:5432/fyp_bus_test",
        }),
      /TEST_DATABASE_CONFIRM/,
    );
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          TEST_DATABASE_URL:
            "postgresql://postgres:postgres@database:5432/fyp_bus",
          TEST_DATABASE_CONFIRM: "FYP_BUS_INTEGRATION",
        }),
      /database name must end in _test/,
    );
    assert.throws(
      () =>
        parseServerEnvironment({
          ...validEnvironment,
          DATABASE_URL:
            "postgresql://developer:password@database:5432/fyp_bus_test?schema=public",
          TEST_DATABASE_URL:
            "postgresql://tester:password@database:5432/fyp_bus_test?schema=integration",
          TEST_DATABASE_CONFIRM: "FYP_BUS_INTEGRATION",
        }),
      /must differ from DATABASE_URL/,
    );

    const environment = parseServerEnvironment({
      ...validEnvironment,
      TEST_DATABASE_URL:
        "postgresql://postgres:postgres@database:5432/fyp_bus_test",
      TEST_DATABASE_CONFIRM: "FYP_BUS_INTEGRATION",
    });
    assert.equal(environment.integrationTest.confirmed, true);
  });
});
