import "server-only";

import { verificationDeliveryMode } from "../domain/email-verification";

export interface EmailVerificationDelivery {
  readonly available: boolean;
  deliver(input: { email: string; rawToken: string }): Promise<{ previewToken?: string }>;
}

class DevelopmentPreviewDelivery implements EmailVerificationDelivery {
  readonly available = true;

  async deliver(input: { rawToken: string }) {
    return { previewToken: input.rawToken };
  }
}

class UnconfiguredProductionDelivery implements EmailVerificationDelivery {
  readonly available = false;

  async deliver(): Promise<never> {
    throw new Error("Production email verification delivery is not configured");
  }
}

export function getEmailVerificationDelivery(): EmailVerificationDelivery {
  return verificationDeliveryMode(process.env.NODE_ENV ?? "development") ===
    "DEVELOPMENT_PREVIEW"
    ? new DevelopmentPreviewDelivery()
    : new UnconfiguredProductionDelivery();
}
