import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { reviewAppealSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getUserFromToken();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { id: appealId } = await params;
    const body = await req.json();
    const { status, adminComment } = reviewAppealSchema.parse(body);

    const appeal = await prisma.penaltyAppeal.findUnique({
      where: { id: appealId },
      include: { penalty: true, student: true },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal record not found" }, { status: 404 });
    }

    if (appeal.status !== "PENDING") {
      return NextResponse.json({ error: `Appeal has already been processed with status: ${appeal.status}` }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. Update Appeal record
      await tx.penaltyAppeal.update({
        where: { id: appealId },
        data: {
          status,
          adminComment: adminComment || null,
          reviewedByAdminId: admin.userId,
          resolvedAt: now,
        },
      });

      if (status === "APPROVED") {
        // Overturn penalty & restore points
        await tx.penalty.update({
          where: { id: appeal.penaltyId },
          data: { status: "OVERTURNED" },
        });

        const newCreditScore = Math.min(100, appeal.student.creditScore + appeal.penalty.creditPointsDeducted);
        const isRestricted = newCreditScore < 40;

        await tx.user.update({
          where: { id: appeal.studentId },
          data: {
            creditScore: newCreditScore,
            isBookingRestricted: isRestricted,
          },
        });

        await tx.notification.create({
          data: {
            userId: appeal.studentId,
            type: "APPEAL_RESOLVED",
            message: `Your penalty appeal was APPROVED. ${appeal.penalty.creditPointsDeducted} credit points restored. ${adminComment ? `Staff note: ${adminComment}` : ""}`,
          },
        });
      } else {
        // Reject appeal & uphold penalty
        await tx.penalty.update({
          where: { id: appeal.penaltyId },
          data: { status: "UPHELD" },
        });

        await tx.notification.create({
          data: {
            userId: appeal.studentId,
            type: "APPEAL_RESOLVED",
            message: `Your penalty appeal was REJECTED. The penalty remains upheld. ${adminComment ? `Staff note: ${adminComment}` : ""}`,
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: `Appeal ${status.toLowerCase()} successfully` });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to process appeal review" }, { status: 500 });
  }
}
