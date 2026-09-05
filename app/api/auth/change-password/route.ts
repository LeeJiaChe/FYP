import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serverEnvironment } from "@/shared/config/env.server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";

export async function POST(req: Request) {
  try {
    assertSameOriginMutation(req);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    user.role === "STUDENT" &&
    !serverEnvironment.demoAuth.studentPasswordLoginEnabled
  ) {
    return NextResponse.json(
      { error: "Students manage sign-in through their TAR UMT Google account." },
      { status: 403 },
    );
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    // Verify the current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    // Hash the new password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: newHash,
        sessionVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, message: "Password changed successfully." });
  } catch {
    return NextResponse.json({ error: "Failed to change password." }, { status: 500 });
  }
}
