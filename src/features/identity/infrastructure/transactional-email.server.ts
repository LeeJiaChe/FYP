import "server-only";

import { Resend } from "resend";

export interface TransactionalEmailResult {
  readonly previewUrl?: string;
}

export interface TransactionalEmailDelivery {
  readonly available: boolean;
  readonly preview: boolean;
  deliverStudentVerification(input: {
    email: string;
    rawToken: string;
  }): Promise<TransactionalEmailResult>;
  deliverStaffPasswordReset(input: {
    email: string;
    rawToken: string;
  }): Promise<TransactionalEmailResult>;
}

export interface EmailTransport {
  send(input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void>;
}

export interface TransactionalEmailConfiguration {
  readonly runtime: "development" | "test" | "production";
  readonly apiKey: string;
  readonly from: string;
  readonly appBaseUrl: string;
}

function link(baseUrl: string, path: string, rawToken: string): string {
  const url = new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("token", rawToken);
  return url.toString();
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

class PreviewTransactionalEmail implements TransactionalEmailDelivery {
  readonly available = true;
  readonly preview = true;

  constructor(private readonly appBaseUrl: string) {}

  async deliverStudentVerification(input: { rawToken: string }) {
    return {
      previewUrl: link(this.appBaseUrl, "/verify-email", input.rawToken),
    };
  }

  async deliverStaffPasswordReset(input: { rawToken: string }) {
    return {
      previewUrl: link(this.appBaseUrl, "/reset-password", input.rawToken),
    };
  }
}

class UnavailableTransactionalEmail implements TransactionalEmailDelivery {
  readonly available = false;
  readonly preview = false;

  async deliverStudentVerification(): Promise<never> {
    throw new Error("Production transactional email is not configured");
  }

  async deliverStaffPasswordReset(): Promise<never> {
    throw new Error("Production transactional email is not configured");
  }
}

class ConfiguredTransactionalEmail implements TransactionalEmailDelivery {
  readonly available = true;
  readonly preview = false;

  constructor(
    private readonly configuration: TransactionalEmailConfiguration,
    private readonly transport: EmailTransport,
  ) {}

  async deliverStudentVerification(input: {
    email: string;
    rawToken: string;
  }): Promise<TransactionalEmailResult> {
    const verificationLink = link(
      this.configuration.appBaseUrl,
      "/verify-email",
      input.rawToken,
    );
    await this.transport.send({
      from: this.configuration.from,
      to: input.email,
      subject: "Verify your shuttle account",
      text: `Verify your shuttle account: ${verificationLink}`,
      html: `<p>Verify your shuttle account:</p><p><a href="${escapeHtml(verificationLink)}">Verify account</a></p>`,
    });
    return {};
  }

  async deliverStaffPasswordReset(input: {
    email: string;
    rawToken: string;
  }): Promise<TransactionalEmailResult> {
    const resetLink = link(
      this.configuration.appBaseUrl,
      "/reset-password",
      input.rawToken,
    );
    await this.transport.send({
      from: this.configuration.from,
      to: input.email,
      subject: "Reset your shuttle staff password",
      text: `Reset your shuttle staff password: ${resetLink}`,
      html: `<p>A password reset was requested for your shuttle staff account.</p><p><a href="${escapeHtml(resetLink)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
    return {};
  }
}

function resendTransport(apiKey: string): EmailTransport {
  const resend = new Resend(apiKey);
  return {
    async send(input) {
      const { error } = await resend.emails.send(input);
      if (error) throw new Error("Transactional email delivery failed");
    },
  };
}

export function createTransactionalEmailDelivery(
  configuration: TransactionalEmailConfiguration,
  transport?: EmailTransport,
): TransactionalEmailDelivery {
  if (configuration.runtime !== "production") {
    return new PreviewTransactionalEmail(configuration.appBaseUrl);
  }
  if (!configuration.apiKey || !configuration.from) {
    return new UnavailableTransactionalEmail();
  }
  return new ConfiguredTransactionalEmail(
    configuration,
    transport ?? resendTransport(configuration.apiKey),
  );
}
