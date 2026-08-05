/**
 * Lightweight test utilities for FYP Bus System audit tests.
 * 
 * These are integration tests that verify security fixes by calling
 * API route handlers directly (no HTTP server needed). 
 * 
 * Run with: npx tsx tests/run-tests.ts
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

// Helper to keep track of cookies (session management)
export class ApiClient {
  private cookie: string = "";
  public baseUrl = "http://localhost:3000/api";

  async post(path: string, body: any) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": this.cookie
      },
      body: JSON.stringify(body)
    });
    this.updateCookie(res);
    return res;
  }

  async patch(path: string, body: any) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cookie": this.cookie
      },
      body: JSON.stringify(body)
    });
    this.updateCookie(res);
    return res;
  }

  async get(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Cookie": this.cookie
      }
    });
    this.updateCookie(res);
    return res;
  }

  private updateCookie(res: any) {
    let setCookies: string[] = [];
    if (typeof res.headers.getSetCookie === 'function') {
      setCookies = res.headers.getSetCookie();
    } else {
      const combined = res.headers.get("set-cookie");
      if (combined) {
        setCookies = [combined]; // Just take the whole string if it's one cookie
      }
    }
    
    if (setCookies && setCookies.length > 0) {
      this.cookie = setCookies.map((c: string) => c.split(";")[0]).join("; ");
    }
  }

  async login(email: string, password: string = "password123") {
    // Some tests might use `admin1` as password
    const res = await this.post("/auth/login", { emailOrStudentId: email, password });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed for ${email}: ${res.status} ${res.statusText} - ${text}`);
    }
  }
}

export function describe(name: string, fn: () => void | Promise<void>) {
  console.log(`\n📋 ${name}`);
  return fn();
}

export async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    failed++;
    const msg = err?.message || String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  ❌ ${name}`);
    console.log(`     ${msg}`);
  }
}

export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message || "Values not equal"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertIncludes(haystack: string, needle: string, message?: string) {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${message || "String not found"}: expected "${haystack}" to include "${needle}"`
    );
  }
}

export function printSummary() {
  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.log(`  ❌ ${f}`));
  }
  console.log("=".repeat(50));
  if (failed > 0) process.exit(1);
}
