import { isFixtureDemoAuthEnabled } from "@/features/identity/infrastructure/demo-auth.server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const demoMode = process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    await isFixtureDemoAuthEnabled();
  return <LoginForm demoMode={demoMode} />;
}
