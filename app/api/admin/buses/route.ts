import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { createBusSchema } from "@/lib/validations";

export async function GET() {
  try {
    const buses = await prisma.bus.findMany({
      orderBy: { plateNumber: "asc" },
      include: {
        _count: { select: { trips: true } },
      },
    });
    return NextResponse.json({ buses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch buses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const validated = createBusSchema.parse(body);

    const bus = await prisma.bus.create({
      data: validated,
    });

    return NextResponse.json({ success: true, bus });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create bus" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, plateNumber, capacity, status } = body;

    if (!id) return NextResponse.json({ error: "Bus ID required" }, { status: 400 });

    const bus = await prisma.bus.update({
      where: { id },
      data: {
        ...(plateNumber ? { plateNumber } : {}),
        ...(capacity ? { capacity } : {}),
        ...(status ? { status } : {}),
      },
    });

    return NextResponse.json({ success: true, bus });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update bus" }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: "Bus ID required" }, { status: 400 });

    await prisma.bus.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete bus" }, { status: 500 });
  }
}
