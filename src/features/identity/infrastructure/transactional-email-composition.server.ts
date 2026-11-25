import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";
import { assertFixtureIdentity, fixtureTarget } from "@/shared/db/disposable-fixture";
import { prisma } from "@/shared/db/prisma.server";
import {
  createTransactionalEmailDelivery,
  type TransactionalEmailDelivery,
} from "./transactional-email.server";

export async function getTransactionalEmailDelivery(): Promise<TransactionalEmailDelivery> {
  const email = serverEnvironment.transactionalEmail;
  let isolatedPreviewAuthorized = false;
  if (serverEnvironment.runtime !== "production" && process.env.FIXTURE_EMAIL_PREVIEW_ENABLED === "true") {
    try {
      const target = fixtureTarget(process.env);
      if (serverEnvironment.database.url === target.url) {
        // Authorize on the same database client used by the identity repositories.
        await assertFixtureIdentity(prisma, target);
        const endpoint = new URL(email.appBaseUrl);
        isolatedPreviewAuthorized = endpoint.protocol === "http:" &&
          endpoint.hostname === "127.0.0.1" &&
          endpoint.port === process.env.FYP_FIXTURE_APP_PORT;
      }
    } catch {
      // Missing or unverifiable fixture proof leaves previews disabled.
    }
  }
  return createTransactionalEmailDelivery({
    runtime: serverEnvironment.runtime,
    isolatedPreviewAuthorized,
    apiKey: email.resendApiKey,
    from: email.from,
    appBaseUrl: email.appBaseUrl,
  });
}
