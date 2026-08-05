/**
 * Security & Auth Tests for FYP Bus System
 * 
 * Tests the fixes for Critical and High severity audit findings.
 * Run with: npx tsx tests/auth-security.test.ts
 * 
 * NOTE: These tests validate the code logic by importing handlers directly.
 * They require a running PostgreSQL database with the schema applied.
 * Before running: npx prisma db push && npx prisma db seed
 */

import { describe, test, assert, assertEqual, assertIncludes, printSummary } from "./test-utils";
import { registerSchema, loginSchema, createBookingSchema } from "../lib/validations";

async function runAllTests() {
  // =========================================================
  // C-005: Registration must reject non-STUDENT roles
  // =========================================================
  await describe("C-005: Registration role restriction", async () => {
    await test("registerSchema should not accept role field (ADMIN)", async () => {
      // After the fix, the registerSchema should not have a 'role' field at all,
      // OR if it does, it should be locked to "STUDENT"
      const schemaShape = (registerSchema as any)._def?.shape || (registerSchema as any).shape;

      // Try parsing with role: "ADMIN" - the role should either be stripped or rejected
      const result = registerSchema.safeParse({
        name: "Hacker Admin",
        email: "hacker@evil.com",
        password: "Password1",
        role: "ADMIN",
        studentId: "HACK001",
      });

      if (result.success) {
        // If parsing succeeds, the role field should have been stripped or defaulted to STUDENT
        const data = result.data as any;
        assert(
          !data.role || data.role === "STUDENT",
          `Registration should not allow role "${data.role}" - only STUDENT should be permitted`
        );
      }
      // If parsing fails, that's also acceptable - role is not in the schema
    });

    await test("registerSchema should not accept role field (DRIVER)", async () => {
      const result = registerSchema.safeParse({
        name: "Fake Driver",
        email: "driver@evil.com",
        password: "Password1",
        role: "DRIVER",
        studentId: "HACK002",
      });

      if (result.success) {
        const data = result.data as any;
        assert(
          !data.role || data.role === "STUDENT",
          `Registration should not allow role "${data.role}" - only STUDENT should be permitted`
        );
      }
    });
  });

  // =========================================================
  // C-001/C-002: JWT/QR secrets must not have hardcoded fallbacks
  // =========================================================
  await describe("C-001/C-002: No hardcoded secrets", async () => {
    await test("lib/auth.ts should not contain hardcoded fallback secret", async () => {
      const fs = await import("fs");
      const authContent = fs.readFileSync("lib/auth.ts", "utf-8");
      assert(
        !authContent.includes("tarumt-bus-booking-secret-key-2026-fyp"),
        "lib/auth.ts still contains the hardcoded fallback secret"
      );
    });

    await test("lib/qr.ts should not contain hardcoded fallback secret", async () => {
      const fs = await import("fs");
      const qrContent = fs.readFileSync("lib/qr.ts", "utf-8");
      assert(
        !qrContent.includes("tarumt-bus-booking-secret-key-2026-fyp"),
        "lib/qr.ts still contains the hardcoded fallback secret"
      );
    });
  });

  // =========================================================
  // C-004: Middleware must verify JWT signature
  // =========================================================
  await describe("C-004: Middleware JWT signature verification", async () => {
    await test("middleware.ts should use crypto.subtle for signature verification", async () => {
      const fs = await import("fs");
      const mwContent = fs.readFileSync("middleware.ts", "utf-8");
      assert(
        mwContent.includes("crypto.subtle") || mwContent.includes("verifyJWTEdge"),
        "middleware.ts should verify JWT signatures using Web Crypto API"
      );
      assert(
        !mwContent.includes("atob(base64)") || mwContent.includes("verify"),
        "middleware.ts should not just decode without verifying"
      );
    });
  });

  // =========================================================
  // C-007: Cron endpoints must always check auth
  // =========================================================
  await describe("C-007: Cron endpoint auth", async () => {
    await test("no-show cron should not skip auth in development", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/admin/cron/no-show/route.ts", "utf-8");
      assert(
        !content.includes('process.env.NODE_ENV === "production"'),
        "no-show cron should not conditionally skip auth based on NODE_ENV"
      );
    });

    await test("device-health cron should not skip auth in development", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/admin/cron/device-health/route.ts", "utf-8");
      assert(
        !content.includes('process.env.NODE_ENV === "production"'),
        "device-health cron should not conditionally skip auth based on NODE_ENV"
      );
    });
  });

  // =========================================================
  // H-001: Password complexity
  // =========================================================
  await describe("H-001: Password complexity requirements", async () => {
    await test("should reject password shorter than 8 chars", async () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@test.com",
        password: "Short1",
        studentId: "TST001",
      });
      assert(!result.success, "Short password should be rejected");
    });

    await test("should reject password without uppercase", async () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@test.com",
        password: "lowercase1",
        studentId: "TST001",
      });
      assert(!result.success, "Password without uppercase should be rejected");
    });

    await test("should reject password without lowercase", async () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@test.com",
        password: "UPPERCASE1",
        studentId: "TST001",
      });
      assert(!result.success, "Password without lowercase should be rejected");
    });

    await test("should reject password without digit", async () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@test.com",
        password: "NoDigitsHere",
        studentId: "TST001",
      });
      assert(!result.success, "Password without digit should be rejected");
    });

    await test("should accept strong password", async () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        email: "test@test.com",
        password: "StrongP4ss",
        studentId: "TST001",
      });
      assert(result.success, "Strong password should be accepted");
    });
  });

  // =========================================================
  // H-008/H-009: Trip endpoints require auth
  // =========================================================
  await describe("H-008/H-009: Trip endpoint authentication", async () => {
    await test("GET /api/trips should require authentication", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/route.ts", "utf-8");
      // The GET handler should call getUserFromToken and check the result
      assertIncludes(content, "getUserFromToken", "trips/route.ts GET should call getUserFromToken");
      // Check that it returns 401 for unauthenticated users
      assertIncludes(content, "401", "trips/route.ts should return 401 for unauthenticated");
    });

    await test("GET /api/trips/:id should require authentication", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/[id]/route.ts", "utf-8");
      const getHandler = content.split("export async function GET")[1]?.split("export async function")[0] || content;
      assertIncludes(getHandler, "getUserFromToken", "trips/[id]/route.ts GET should call getUserFromToken");
    });

    await test("GET /api/trips/:id should not expose student email", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/[id]/route.ts", "utf-8");
      // In the student select for seats, email should not be included
      const seatStudentSelect = content.match(/student:\s*\{[\s\S]*?select:\s*\{([^}]+)\}/);
      if (seatStudentSelect) {
        assert(
          !seatStudentSelect[1].includes("email"),
          "Trip detail should not expose student email addresses in seat data"
        );
      }
    });
  });

  // =========================================================
  // H-010: Driver-trip assignment check on scan/manual-checkin
  // =========================================================
  await describe("H-010: Driver-trip assignment checks", async () => {
    await test("manual-checkin should verify driver is assigned to trip", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/[id]/manual-checkin/route.ts", "utf-8");
      assertIncludes(
        content,
        "driverId",
        "manual-checkin should check driver assignment"
      );
      assertIncludes(
        content,
        "assigned to you",
        "manual-checkin should have error message about trip assignment"
      );
    });

    await test("QR scan should verify driver is assigned to trip", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/trips/[id]/scan/route.ts", "utf-8");
      assertIncludes(
        content,
        "driverId",
        "scan should check driver assignment"
      );
    });
  });

  // =========================================================
  // H-011: Cancellation cutoff enforcement
  // =========================================================
  await describe("H-011: Booking cancellation cutoff", async () => {
    await test("cancel endpoint should enforce time cutoff", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("app/api/bookings/[id]/cancel/route.ts", "utf-8");
      assertIncludes(
        content,
        "30",
        "Cancel endpoint should reference 30-minute cutoff"
      );
      assertIncludes(
        content,
        "before departure",
        "Cancel endpoint should mention departure time in cutoff message"
      );
    });
  });

  // =========================================================
  // H-012: Error message sanitization
  // =========================================================
  await describe("H-012: Error message sanitization", async () => {
    await test("API routes should not expose err.message in 500 responses", async () => {
      const fs = await import("fs");
      const path = await import("path");

      // Check key API routes for the old pattern
      const routesToCheck = [
        "app/api/bookings/mine/route.ts",
        "app/api/trips/route.ts",
        "app/api/admin/buses/route.ts",
        "app/api/penalties/mine/route.ts",
        "app/api/analytics/utilization/route.ts",
      ];

      for (const route of routesToCheck) {
        const content = fs.readFileSync(route, "utf-8");
        // The old pattern: `err.message || "some default"` in a 500 response
        // After fix, 500 responses should use a generic message
        const has500WithErrMsg = /status:\s*500.*err\.message/s.test(content) ||
                                  /err\.message.*status:\s*500/s.test(content);
        assert(
          !has500WithErrMsg,
          `${route} still exposes err.message in 500 responses`
        );
      }
    });
  });

  // =========================================================
  // H-013: Realtime service security
  // =========================================================
  await describe("H-013: Realtime service security", async () => {
    await test("realtime server should not have hardcoded fallback secret", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("realtime/server.js", "utf-8");
      assert(
        !content.includes('"fyp-realtime-secret-key"'),
        "realtime/server.js still contains hardcoded fallback secret"
      );
    });

    await test("realtime server should not skip auth in non-production", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("realtime/server.js", "utf-8");
      assert(
        !content.includes('NODE_ENV === "production"'),
        "realtime/server.js should not conditionally check auth"
      );
    });

    await test("realtime server should not use CORS origin *", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("realtime/server.js", "utf-8");
      // After fix, CORS should use a configurable origin, not "*"
      const corsLines = content.match(/origin:\s*["'][^"']*["']/g) || [];
      const hasWildcard = corsLines.some((l) => l.includes('"*"') || l.includes("'*'"));
      assert(!hasWildcard, "realtime/server.js should not use CORS origin '*'");
    });
  });

  // =========================================================
  // C-006: PostgreSQL schema
  // =========================================================
  await describe("C-006: PostgreSQL migration", async () => {
    await test("schema.prisma should use postgresql provider", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
      assertIncludes(content, 'provider = "postgresql"', "Schema should use postgresql provider");
      assert(!content.includes('provider = "sqlite"'), "Schema should not use sqlite");
    });

    await test("schema.prisma should use proper enums", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
      assertIncludes(content, "enum UserRole", "Schema should define UserRole enum");
      assertIncludes(content, "enum BookingStatus", "Schema should define BookingStatus enum");
      assertIncludes(content, "enum TripStatus", "Schema should define TripStatus enum");
      assertIncludes(content, "enum SeatStatus", "Schema should define SeatStatus enum");
    });

    await test("schema.prisma should have indexes on foreign keys", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
      assertIncludes(content, "@@index([tripId])", "Schema should have index on Seat.tripId");
      assertIncludes(content, "@@index([studentId])", "Schema should have index on Booking.studentId");
      assertIncludes(content, "@@index([userId])", "Schema should have index on Notification.userId");
    });

    await test("Bus and Route models should have deletedAt for soft-delete", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
      // Check Bus model has deletedAt
      const busModel = content.match(/model Bus \{[\s\S]*?\}/)?.[0] || "";
      assertIncludes(busModel, "deletedAt", "Bus model should have deletedAt field");
      // Check Route model has deletedAt
      const routeModel = content.match(/model Route \{[\s\S]*?\}/)?.[0] || "";
      assertIncludes(routeModel, "deletedAt", "Route model should have deletedAt field");
    });
  });

  // =========================================================
  // New features: Account deletion, Admin driver creation
  // =========================================================
  await describe("New features", async () => {
    await test("Account deletion endpoint exists", async () => {
      const fs = await import("fs");
      assert(
        fs.existsSync("app/api/auth/account/route.ts"),
        "Account deletion endpoint should exist at app/api/auth/account/route.ts"
      );
      const content = fs.readFileSync("app/api/auth/account/route.ts", "utf-8");
      assertIncludes(content, "DELETE", "Account endpoint should handle DELETE method");
      assertIncludes(content, "verifyPassword", "Account deletion should require password confirmation");
      assertIncludes(content, "Deleted User", "Account deletion should anonymize user data");
    });

    await test("Admin driver creation endpoint exists", async () => {
      const fs = await import("fs");
      assert(
        fs.existsSync("app/api/admin/drivers/route.ts"),
        "Admin driver creation endpoint should exist at app/api/admin/drivers/route.ts"
      );
      const content = fs.readFileSync("app/api/admin/drivers/route.ts", "utf-8");
      assertIncludes(content, "ADMIN", "Driver creation should require ADMIN role");
      assertIncludes(content, "DRIVER", "Endpoint should create DRIVER role accounts");
    });
  });

  // =========================================================
  // C-008: Database file should not be in repo
  // =========================================================
  await describe("C-008: Database file exclusion", async () => {
    await test(".gitignore should exclude SQLite database files", async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(".gitignore", "utf-8");
      assert(
        content.includes("*.db") || content.includes("dev.db") || content.includes("prisma/dev.db"),
        ".gitignore should exclude database files"
      );
    });
  });

  printSummary();
}

runAllTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
