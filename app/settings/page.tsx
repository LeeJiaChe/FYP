import { redirect } from "next/navigation";

import SettingsPortal from "@/features/identity/ui/SettingsPortal";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <SettingsPortal
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
