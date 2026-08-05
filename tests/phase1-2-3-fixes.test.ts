import { describe, test, assert, assertIncludes, printSummary } from "./test-utils";

async function runTests() {
  await describe("003: Data Integrity (Trip PII leak)", async () => {
    await test("trip endpoint should redact student name and ID for STUDENT role", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/[id]/route.ts", "utf-8");
      
      // Ensure the fix checks role and uses '***' or similar for redaction
      assertIncludes(
        content,
        '"***"',
        "Trip endpoint should redact student IDs with *** or similar"
      );
      assertIncludes(
        content,
        '"Student"',
        "Trip endpoint should redact student names with 'Student'"
      );
    });
  });

  await describe("005: Validation in PATCH endpoints", async () => {
    await test("Bus PATCH endpoint should use updateBusSchema", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/admin/buses/route.ts", "utf-8");
      assertIncludes(
        content,
        "updateBusSchema.parse(body)",
        "Bus PATCH endpoint should validate body using Zod"
      );
    });
    
    await test("Route PATCH endpoint should use updateRouteSchema", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/admin/routes/route.ts", "utf-8");
      assertIncludes(
        content,
        "updateRouteSchema.parse(body)",
        "Route PATCH endpoint should validate body using Zod"
      );
    });
  });

  await describe("001: Rate Limiting", async () => {
    await test("Login and Register routes should check rate limits", async () => {
      const fs = await import("fs");
      const login = fs.readFileSync("app/api/auth/login/route.ts", "utf-8");
      const register = fs.readFileSync("app/api/auth/register/route.ts", "utf-8");
      assertIncludes(login, "loginRateLimiter.check", "Login route should use loginRateLimiter");
      assertIncludes(register, "registerRateLimiter.check", "Register route should use registerRateLimiter");
    });
  });

  await describe("002: JWT Token Invalidation (sessionVersion)", async () => {
    await test("sessionVersion is validated in auth helpers and models", async () => {
      const fs = await import("fs");
      const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
      assertIncludes(schema, "sessionVersion", "User model should have sessionVersion");

      const auth = fs.readFileSync("lib/auth.ts", "utf-8");
      assertIncludes(auth, "sessionVersion", "JWTPayload should have sessionVersion");
      assertIncludes(auth, "user.sessionVersion !== payload.sessionVersion", "getCurrentUser should check sessionVersion");
      
      const logout = fs.readFileSync("app/api/auth/logout/route.ts", "utf-8");
      assertIncludes(logout, "sessionVersion: { increment: 1 }", "Logout should increment sessionVersion");

      const changePw = fs.readFileSync("app/api/auth/change-password/route.ts", "utf-8");
      assertIncludes(changePw, "sessionVersion: { increment: 1 }", "Change password should increment sessionVersion");
    });
  });

  await describe("004: Bus Capacity Rules", async () => {
    await test("PATCH buses should block decreasing capacity with active trips", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/admin/buses/route.ts", "utf-8");
      assertIncludes(
        content,
        "Cannot decrease capacity",
        "PATCH bus should block capacity decrease if active trips exist"
      );
    });
  });

  await describe("007: Waitlist Race Condition", async () => {
    await test("schema.prisma should enforce unique tripId and waitlistPosition", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
      assertIncludes(
        content,
        "@@unique([tripId, waitlistPosition])",
        "Booking model should enforce unique waitlist positions per trip"
      );
    });
  });

  printSummary();
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
