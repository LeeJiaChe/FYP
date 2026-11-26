import { expect, test } from "@playwright/test";
import jwt from "jsonwebtoken";

test("logout clears the current browser and revokes another staff session; expired sessions fail closed", async ({ request, playwright, baseURL }) => {
  const login = async (context) => {
    const response = await context.post("/api/auth/login", {
      headers: { origin: baseURL },
      data: { emailOrStudentId: "driver2@tarumt.edu.my", password: "password123" },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).user.id;
  };
  const other = await playwright.request.newContext({ baseURL });
  try {
    const userId = await login(request);
    await login(other);
    expect((await other.get("/api/auth/me")).ok()).toBe(true);
    expect((await request.post("/api/auth/logout", { headers: { origin: baseURL } })).ok()).toBe(true);
    expect((await request.get("/api/auth/me")).status()).toBe(401);
    expect((await other.get("/api/auth/me")).status()).toBe(401);
    const expired = jwt.sign({ userId, role: "DRIVER", sessionVersion: 2 }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await other.get("/api/auth/me", { headers: { cookie: `fyp_session=${expired}` } })).status()).toBe(401);
  } finally {
    await other.dispose();
  }
});
