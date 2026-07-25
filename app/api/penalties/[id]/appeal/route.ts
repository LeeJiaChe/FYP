import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { submitAppealSchema } from "@/lib/validations";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: penaltyId } = await params;
    const body = await req.json();
    const { reason } = submitAppealSchema.parse(body);

    const penalty = await prisma.penalty.findUnique({
      where: { id: penaltyId },
      include: { appeals: true },
    });

    if (!penalty) {
      return NextResponse.json({ error: "Penalty not found" }, { status: 404 });
    }

    if (penalty.studentId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (penalty.appeals.length > 0) {
      return NextResponse.json({ error: "An appeal has already been submitted for this penalty" }, { status: 400 });
    }

    const appeal = await prisma.$transaction(async (tx) => {
      await tx.penalty.update({
        where: { id: penaltyId },
        data: { status: "APPEALED" },
      });

      const newAppeal = await tx.penaltyAppeal.create({
        data: {
          penaltyId,
          studentId: user.userId,
          reason,
          status: "PENDING",
        },
      });

      return newAppeal;
    });

    return NextResponse.json({ success: true, appeal });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to submit appeal" }, { status: 500 });
  }
}
