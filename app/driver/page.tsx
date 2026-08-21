import { redirect } from "next/navigation";

import DriverPortal from "@/features/boarding/ui/DriverPortal";
import { getCurrentUser } from "@/lib/auth";

export default async function DriverPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "DRIVER") redirect(user.role === "ADMIN" ? "/admin" : "/student");

  return (
    <DriverPortal
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
