import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  studentEmailSchema,
  studentIdSchema,
  studentLoginIdentifierSchema,
} from "../../../src/shared/validation/student-identity";
import { uuidSchema } from "../../../src/shared/types/uuid";

describe("student identity normalization", () => {
  it("trims/lowercases the approved student email domain", () => {
    assert.equal(
      studentEmailSchema.parse("  Any.Local+Part@STUDENT.TARC.EDU.MY  "),
      "any.local+part@student.tarc.edu.my",
    );
  });

  it("does not invent a student-number local-part rule", () => {
    assert.equal(
      studentEmailSchema.parse("name.surname@student.tarc.edu.my"),
      "name.surname@student.tarc.edu.my",
    );
  });

  it("rejects other domains and normalizes student IDs", () => {
    assert.throws(
      () => studentEmailSchema.parse("student@tarumt.edu.my"),
      /student\.tarc\.edu\.my/,
    );
    assert.equal(studentIdSchema.parse("  24wab01234  "), "24WAB01234");
    assert.equal(studentLoginIdentifierSchema.parse("  abc123  "), "ABC123");
  });

  it("provides one runtime UUID contract for external IDs", () => {
    assert.equal(
      uuidSchema.parse("123e4567-e89b-42d3-a456-426614174000"),
      "123e4567-e89b-42d3-a456-426614174000",
    );
    assert.throws(() => uuidSchema.parse("seat-1"), /valid UUID/);
  });
});
