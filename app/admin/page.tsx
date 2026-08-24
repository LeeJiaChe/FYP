import { redirect } from "next/navigation";

import AdminPortal from "@/features/fleet/ui/AdminPortal";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect(user.role === "DRIVER" ? "/driver" : "/student");

  return (
    <AdminPortal
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
