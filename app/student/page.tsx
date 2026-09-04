import { redirect } from "next/navigation";

import StudentPortal from "@/features/bookings/ui/StudentPortal";
import { getCurrentUser } from "@/lib/auth";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect(user.role === "ADMIN" ? "/admin" : "/driver");
  const { view } = await searchParams;
  const initialView = ["home", "book", "journeys", "track", "account"].includes(view ?? "")
    ? view as "home" | "book" | "journeys" | "track" | "account"
    : "home";

  return (
    <StudentPortal
      initialTime={new Date().toISOString()}
      initialView={initialView}
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
