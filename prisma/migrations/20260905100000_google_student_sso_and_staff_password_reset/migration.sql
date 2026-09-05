-- Google-only Students do not hold an application password. Staff credential
-- requirements remain enforced by the identity application boundary.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TYPE "StudentIdentityAssurance" ADD VALUE 'GOOGLE_WORKSPACE_VERIFIED';

CREATE TYPE "ExternalAuthProvider" AS ENUM ('GOOGLE');

CREATE TABLE "ExternalAuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ExternalAuthProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "emailAtLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalAuthIdentity_provider_providerSubject_key"
  ON "ExternalAuthIdentity"("provider", "providerSubject");
CREATE UNIQUE INDEX "ExternalAuthIdentity_userId_provider_key"
  ON "ExternalAuthIdentity"("userId", "provider");
CREATE INDEX "ExternalAuthIdentity_userId_idx"
  ON "ExternalAuthIdentity"("userId");

ALTER TABLE "ExternalAuthIdentity"
  ADD CONSTRAINT "ExternalAuthIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- The browser never reads identity links or one-time credential hashes through
-- Supabase's Data API. With no public policies, RLS provides deny-by-default
-- defense in depth if these public-schema tables are exposed by project settings.
ALTER TABLE "ExternalAuthIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
