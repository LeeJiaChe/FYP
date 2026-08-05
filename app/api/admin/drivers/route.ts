import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken, hashPassword } from "@/lib/auth";
import { z } from "zod";

const createDriverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

/**
 * POST /api/admin/drivers — Admin-only endpoint to create driver accounts.
 * Drivers cannot self-register; they must be created by an admin.
 */
export async function POST(req: Request) {
  try {
    const admin = await getUserFromToken();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin role required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createDriverSchema.parse(body);

    // Check for existing user with same email
    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(validated.password);

    const driver = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        passwordHash,
        role: "DRIVER",
      },
    });

    return NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        role: driver.role,
      },
    });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg =
        err.issues?.[0]?.message ||
        err.errors?.[0]?.message ||
        err.message ||
        "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[admin/drivers] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
