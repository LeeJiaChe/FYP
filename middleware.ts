import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("fyp_session")?.value;

  let userRole: string | null = null;

  if (token) {
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4 !== 0) {
          base64 += "=";
        }
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const parsed = JSON.parse(jsonPayload);
        if (parsed && parsed.exp && parsed.exp * 1000 > Date.now()) {
          userRole = parsed.role || null;
        }
      }
    } catch {
      userRole = null;
    }
  }

  // Redirect signed-in users away from root landing page (/) to their respective dashboard
  if (pathname === "/" && token && userRole) {
    if (userRole === "STUDENT") return NextResponse.redirect(new URL("/student", request.url));
    if (userRole === "DRIVER") return NextResponse.redirect(new URL("/driver", request.url));
    if (userRole === "ADMIN") return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Protected student routes (/student/*)
  if (pathname.startsWith("/student")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "STUDENT") {
      const target = userRole === "ADMIN" ? "/admin" : userRole === "DRIVER" ? "/driver" : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // Protected driver routes (/driver/*)
  if (pathname.startsWith("/driver")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "DRIVER") {
      const target = userRole === "ADMIN" ? "/admin" : userRole === "STUDENT" ? "/student" : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // Protected admin routes (/admin/*)
  if (pathname.startsWith("/admin")) {
    if (!token || !userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("fyp_session");
      return res;
    }
    if (userRole !== "ADMIN") {
      const target = userRole === "DRIVER" ? "/driver" : userRole === "STUDENT" ? "/student" : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/student/:path*", "/driver/:path*", "/admin/:path*"],
};
