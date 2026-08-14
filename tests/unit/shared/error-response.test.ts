import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import {
  conflict,
  forbidden,
  internalError,
  invariantViolation,
  notFound,
  unauthenticated,
  validationError,
} from "../../../src/shared/application/application-error";
import { mapErrorToHttp } from "../../../src/shared/http/error-response";

describe("application error HTTP mapping", () => {
  it("maps typed application errors consistently", () => {
    const cases = [
      [unauthenticated(), 401, "UNAUTHENTICATED"],
      [forbidden(), 403, "FORBIDDEN"],
      [notFound(), 404, "NOT_FOUND"],
      [validationError(), 400, "VALIDATION"],
      [conflict(), 409, "CONFLICT"],
      [invariantViolation(), 422, "INVARIANT_VIOLATION"],
    ] as const;

    for (const [error, status, code] of cases) {
      const mapping = mapErrorToHttp(error, "request-1");
      assert.equal(mapping.status, status);
      assert.equal(mapping.body.error.code, code);
      assert.equal(mapping.body.error.requestId, "request-1");
      assert.equal(mapping.unexpected, false);
    }
  });

  it("maps Zod issues without exposing the submitted value", () => {
    const secretValue = "do-not-return-this-value";
    const result = z.object({ count: z.number() }).safeParse({
      count: secretValue,
    });
    assert.equal(result.success, false);
    if (result.success) return;

    const mapping = mapErrorToHttp(result.error, "request-2");
    assert.equal(mapping.status, 400);
    assert.equal(mapping.body.error.code, "VALIDATION");
    assert.doesNotMatch(JSON.stringify(mapping.body), new RegExp(secretValue));
  });

  it("never exposes unexpected or internal implementation details", () => {
    for (const error of [
      new Error("database password was rejected"),
      internalError(new Error("private upstream detail")),
    ]) {
      const mapping = mapErrorToHttp(error, "request-3");
      assert.equal(mapping.status, 500);
      assert.equal(mapping.body.error.message, "Internal server error");
      assert.doesNotMatch(JSON.stringify(mapping.body), /password|upstream/);
      assert.equal(mapping.unexpected, true);
    }
  });
});
