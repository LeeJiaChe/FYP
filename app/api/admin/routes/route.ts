import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { createRouteSchema } from "@/lib/validations";

export async function GET() {
  try {
    const routes = await prisma.route.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { trips: true } } },
    });

    const formatted = routes.map((r) => ({
      id: r.id,
      name: r.name,
      stops: JSON.parse(r.stops || "[]"),
      tripsCount: r._count.trips,
    }));

    return NextResponse.json({ routes: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch routes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const validated = createRouteSchema.parse(body);

    const route = await prisma.route.create({
      data: {
        name: validated.name,
        stops: JSON.stringify(validated.stops),
      },
    });

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        name: route.name,
        stops: JSON.parse(route.stops),
      },
    });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create route" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, stops } = body;
    if (!id) return NextResponse.json({ error: "Route ID required" }, { status: 400 });

    const route = await prisma.route.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(stops ? { stops: JSON.stringify(stops) } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        name: route.name,
        stops: JSON.parse(route.stops),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update route" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Route ID required" }, { status: 400 });

    await prisma.route.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete route" }, { status: 500 });
  }
}
