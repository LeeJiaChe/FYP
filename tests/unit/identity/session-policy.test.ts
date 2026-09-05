import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";

import {
  applicationSessionCookieOptions,
  COOKIE_NAME,
  createApplicationSession,
} from "@/lib/auth";

describe("application session issuance", () => {
  it("uses the same secure cookie contract for Google and password identities", () => {
    const passwordSession = createApplicationSession({
      id: "driver-id",
      role: "DRIVER",
      email: "driver@tarumt.edu.my",
      name: "Driver",
      sessionVersion: 2,
    });
    const googleSession = createApplicationSession({
      id: "student-id",
      role: "STUDENT",
      email: "student@student.tarc.edu.my",
      name: "Student",
      sessionVersion: 1,
    });
    assert.equal(passwordSession.name, COOKIE_NAME);
    assert.equal(googleSession.name, COOKIE_NAME);
    assert.deepEqual(passwordSession.options, googleSession.options);
    assert.deepEqual(applicationSessionCookieOptions("production"), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    const payload = jwt.decode(googleSession.value) as jwt.JwtPayload;
    assert.equal(payload.role, "STUDENT");
    assert.equal(payload.userId, "student-id");
    assert.equal(payload.credential, undefined);
    assert.equal(payload.googleToken, undefined);
  });
});
