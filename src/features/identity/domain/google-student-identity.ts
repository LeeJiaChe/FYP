export interface GoogleIdTokenClaims {
  readonly sub?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly hd?: string;
  readonly name?: string;
  readonly aud?: string | readonly string[];
  readonly iss?: string;
  readonly exp?: number;
}

export interface VerifiedGoogleStudentIdentity {
  readonly provider: "GOOGLE";
  readonly providerSubject: string;
  readonly email: string;
  readonly name: string;
  readonly hostedDomain: string;
}

export type GoogleIdentityRejection =
  | "MISSING_SUBJECT"
  | "MISSING_EMAIL"
  | "EMAIL_UNVERIFIED"
  | "EMAIL_DOMAIN_NOT_ALLOWED"
  | "HOSTED_DOMAIN_MISSING"
  | "HOSTED_DOMAIN_NOT_ALLOWED"
  | "AUDIENCE_MISMATCH"
  | "ISSUER_INVALID"
  | "TOKEN_EXPIRED";

export class GoogleIdentityClaimsError extends Error {
  constructor(readonly code: GoogleIdentityRejection) {
    super(code);
    this.name = "GoogleIdentityClaimsError";
  }
}

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

function hasAudience(
  audience: string | readonly string[] | undefined,
  clientId: string,
): boolean {
  return typeof audience === "string"
    ? audience === clientId
    : Array.isArray(audience) && audience.includes(clientId);
}

export function validateGoogleStudentClaims(input: {
  claims: GoogleIdTokenClaims;
  clientId: string;
  hostedDomain: string;
  now: Date;
}): VerifiedGoogleStudentIdentity {
  const { claims } = input;
  const hostedDomain = input.hostedDomain.trim().toLowerCase();
  if (!claims.sub?.trim()) throw new GoogleIdentityClaimsError("MISSING_SUBJECT");
  if (!hasAudience(claims.aud, input.clientId)) {
    throw new GoogleIdentityClaimsError("AUDIENCE_MISMATCH");
  }
  if (!claims.iss || !GOOGLE_ISSUERS.has(claims.iss)) {
    throw new GoogleIdentityClaimsError("ISSUER_INVALID");
  }
  if (!claims.exp || claims.exp * 1_000 <= input.now.getTime()) {
    throw new GoogleIdentityClaimsError("TOKEN_EXPIRED");
  }
  if (!claims.email) throw new GoogleIdentityClaimsError("MISSING_EMAIL");
  if (claims.email_verified !== true) {
    throw new GoogleIdentityClaimsError("EMAIL_UNVERIFIED");
  }

  const email = claims.email.trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || email.slice(separator + 1) !== hostedDomain) {
    throw new GoogleIdentityClaimsError("EMAIL_DOMAIN_NOT_ALLOWED");
  }
  if (!claims.hd) throw new GoogleIdentityClaimsError("HOSTED_DOMAIN_MISSING");
  if (claims.hd.trim().toLowerCase() !== hostedDomain) {
    throw new GoogleIdentityClaimsError("HOSTED_DOMAIN_NOT_ALLOWED");
  }

  return Object.freeze({
    provider: "GOOGLE" as const,
    providerSubject: claims.sub,
    email,
    name: claims.name?.trim() || email.slice(0, separator),
    hostedDomain,
  });
}
