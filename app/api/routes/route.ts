import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

/**
 * Public read-only route list — accessible to all authenticated users
 * (students need this to populate route filters in the booking UI).
 * Mutating operations (POST/PATCH/DELETE) remain admin-only under /api/admin/routes.
 */
export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routes = await prisma.route.findMany({
      orderBy: { name: "asc" },
    });

    const formatted = routes.map((r) => ({
      id: r.id,
      name: r.name,
      stops: JSON.parse(r.stops || "[]"),
    }));

    return NextResponse.json({ routes: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch routes" }, { status: 500 });
  }
}
