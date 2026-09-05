import "server-only";

import { OAuth2Client } from "google-auth-library";

import type { GoogleCredentialVerifier } from "../application/google-student-auth";

const client = new OAuth2Client();

export const googleCredentialVerifier: GoogleCredentialVerifier = {
  async verifyIdToken({ credential, audience }) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Google ID token payload is missing");
    return payload;
  },
};
