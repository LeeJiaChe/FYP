import { redirect } from "next/navigation";

import StudentPortal from "@/features/bookings/ui/StudentPortal";
import { getCurrentUser } from "@/lib/auth";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect(user.role === "ADMIN" ? "/admin" : "/driver");

  return (
    <StudentPortal
      initialUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        creditScore: user.creditScore,
      }}
    />
  );
}
