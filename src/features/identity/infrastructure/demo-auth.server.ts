import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";
import { assertFixtureIdentity, fixtureTarget } from "@/shared/db/disposable-fixture";
import { prisma } from "@/shared/db/prisma.server";

export async function isFixtureDemoUiEnabled(): Promise<boolean> {
  return process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    await isFixtureDemoAuthEnabled();
}

export async function isFixtureDemoAuthEnabled(): Promise<boolean> {
  if (!serverEnvironment.demoAuth.studentPasswordLoginEnabled) return false;
  try {
    const target = fixtureTarget(process.env);
    if (target.url !== serverEnvironment.database.url) return false;
    await assertFixtureIdentity(prisma, target);
    return true;
  } catch {
    return false;
  }
}
