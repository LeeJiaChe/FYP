import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createTransactionalEmailDelivery,
  type EmailTransport,
} from "@/features/identity/infrastructure/transactional-email.server";

describe("transactional email delivery", () => {
  it("sends staff reset and verification links through configured production transport", async () => {
    const sent: Array<Parameters<EmailTransport["send"]>[0]> = [];
    const delivery = createTransactionalEmailDelivery(
      {
        runtime: "production",
        apiKey: "resend-server-secret",
        from: "Shuttle Operator <notifications@owned.example>",
        appBaseUrl: "https://shuttle.example/app/..",
      },
      { async send(input) { sent.push(input); } },
    );
    const resetResult = await delivery.deliverStaffPasswordReset({
      email: "driver@tarumt.edu.my",
      rawToken: "raw-reset-token",
    });
    const verificationResult = await delivery.deliverStudentVerification({
      email: "student@student.tarc.edu.my",
      rawToken: "raw-verification-token",
    });
    assert.equal(delivery.available, true);
    assert.equal(delivery.preview, false);
    assert.deepEqual(resetResult, {});
    assert.deepEqual(verificationResult, {});
    assert.equal(sent[0]?.to, "driver@tarumt.edu.my");
    assert.equal(sent[0]?.from, "Shuttle Operator <notifications@owned.example>");
    assert.match(sent[0]?.text ?? "", /^Reset your shuttle staff password: https:\/\/shuttle\.example\/reset-password\?token=/);
    assert.equal(sent[1]?.to, "student@student.tarc.edu.my");
    assert.match(sent[1]?.text ?? "", /^Verify your shuttle account: https:\/\/shuttle\.example\/verify-email\?token=/);
  });

  it("fails closed when production email configuration is missing", async () => {
    const delivery = createTransactionalEmailDelivery({
      runtime: "production",
      apiKey: "",
      from: "",
      appBaseUrl: "https://shuttle.example",
    });
    assert.equal(delivery.available, false);
    assert.equal(delivery.preview, false);
    await assert.rejects(
      delivery.deliverStaffPasswordReset({ email: "staff@example.test", rawToken: "token" }),
      /not configured/,
    );
  });

  it("keeps preview links in non-production only and derives them from APP_BASE_URL", async () => {
    const delivery = createTransactionalEmailDelivery({
      runtime: "development",
      apiKey: "",
      from: "",
      appBaseUrl: "http://localhost:3000",
    });
    const result = await delivery.deliverStaffPasswordReset({
      email: "driver@example.test",
      rawToken: "preview-token",
    });
    assert.equal(delivery.preview, true);
    assert.equal(
      result.previewUrl,
      "http://localhost:3000/reset-password?token=preview-token",
    );
  });
});
