import { isFixtureDemoUiEnabled } from "@/features/identity/infrastructure/demo-auth.server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  return <LoginForm demoMode={await isFixtureDemoUiEnabled()} />;
}
