import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const TRUSTED_SERVICE_PATHS = new Set([
  "/api/location/ingest",
  "/api/location/simulate",
]);

async function verifyJWTEdge(
  token: string,
  secret: string
): Promise<{ userId: string; role: string; exp: number } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureStr = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const signatureBytes = Uint8Array.from(
      atob(signatureStr + "=".repeat((4 - (signatureStr.length % 4)) % 4)),
      (c) => c.charCodeAt(0)
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, data);
    if (!isValid) return null;

    let base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);

    if (!parsed.exp || parsed.exp * 1000 <= Date.now()) return null;

    return { userId: parsed.userId, role: parsed.role, exp: parsed.exp };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") &&
    MUTATION_METHODS.has(request.method) &&
    !pathname.startsWith("/api/admin/cron/") &&
    !TRUSTED_SERVICE_PATHS.has(pathname)
  ) {
    try {
      assertSameOriginMutation(request);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Cross-origin mutation rejected",
          },
        },
        { status: 403 },
      );
    }
  }

  const token = request.cookies.get("fyp_session")?.value;
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (
      pathname.startsWith("/student") ||
      pathname.startsWith("/driver") ||
      pathname.startsWith("/admin")
    ) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  let userRole: string | null = null;

  if (token) {
    const payload = await verifyJWTEdge(token, secret);
    if (payload) {
      userRole = payload.role;
    }
  }

  if (pathname === "/" && token && userRole) {
    if (userRole === "STUDENT")
      return NextResponse.redirect(new URL("/student", request.url));
    if (userRole === "DRIVER")
      return NextResponse.redirect(new URL("/driver", request.url));
    if (userRole === "ADMIN")
      return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/student")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "STUDENT") {
      const target =
        userRole === "ADMIN"
          ? "/admin"
          : userRole === "DRIVER"
          ? "/driver"
          : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  if (pathname.startsWith("/driver")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "DRIVER") {
      const target =
        userRole === "ADMIN"
          ? "/admin"
          : userRole === "STUDENT"
          ? "/student"
          : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "ADMIN") {
      const target =
        userRole === "DRIVER"
          ? "/driver"
          : userRole === "STUDENT"
          ? "/student"
          : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/student/:path*",
    "/driver/:path*",
    "/admin/:path*",
    "/api/:path*",
  ],
};
