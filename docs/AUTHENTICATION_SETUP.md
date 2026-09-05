# Authentication and Transactional Email Setup

This application keeps its existing signed JWT session in the HttpOnly
`fyp_session` cookie. Google Identity Services proves a Student's external
identity only; it does not replace the application session system. Driver and
Admin accounts continue to use an application email and password.

## Google Student sign-in

1. In Google Cloud Console, select or create the project used for this
   application.
2. Configure the Google Auth Platform branding/audience settings appropriate
   for the operator's Workspace deployment.
3. Under **Clients**, create an OAuth client with application type **Web
   application**.
4. Add each exact browser origin under **Authorized JavaScript origins**:
   - local development, normally `http://localhost:3000`;
   - the production HTTPS origin, for example `https://shuttle.example`.
5. This application uses the GIS JavaScript popup callback and sends the
   returned ID token to its own `/api/auth/google/student` endpoint. It does not
   use the OAuth authorization-code redirect flow, so no redirect URI is needed
   for this implementation.
6. Set the Web Client ID as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. A client ID is a
   public identifier, not a secret. The backend uses the same value as the
   mandatory ID-token audience.
7. Set `GOOGLE_STUDENT_HOSTED_DOMAIN="student.tarc.edu.my"` unless controlled
   testing proves TAR UMT's Workspace reports a different primary hosted-domain
   value.

The browser passes the hosted domain as an account-chooser hint only. The
backend verifies the Google signature, audience, issuer, expiry, verified email,
exact email domain, and `hd` claim with `google-auth-library`. An address suffix
alone is never accepted. The database stores Google `sub` as the stable provider
subject and never stores the raw ID token, access token, or refresh token. No
Google API scopes for Gmail, Drive, Calendar, Contacts, or profile writes are
requested.

### Verify the real Workspace claim

Use a real TAR UMT Student Workspace account in a controlled environment after
the JavaScript origin is authorized. Complete the GIS chooser and inspect only
the backend's safe success/rejection result. Do not log or paste the raw ID token
into project logs or documentation. If an otherwise valid institutional account
is rejected specifically for hosted domain, confirm the Workspace account's
primary `hd` value with the institution/operator and change
`GOOGLE_STUDENT_HOSTED_DOMAIN`; do not weaken the backend to an email-suffix-only
check.

If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty, the login and registration pages
show that Google Student sign-in is not configured. Staff password login and an
explicitly enabled local demo flow remain usable.

## Resend transactional email

1. Create a Resend account for the project/operator.
2. Add a sending domain that the project/operator owns or is authorized to use.
3. Publish and verify the DNS records required by Resend, including its current
   SPF/DKIM instructions.
4. Create a restricted production API key and set it as `RESEND_API_KEY` on the
   server only.
5. Set `EMAIL_FROM`, for example
   `TAR UMT Shuttle <notifications@your-owned-domain.example>`, using the verified
   domain.
6. Set `APP_BASE_URL` to the public HTTPS application origin. Password-reset and
   compatibility verification links are derived from this value.

Do not use or impersonate `tarc.edu.my`, `tarumt.edu.my`, or another university
domain unless its owner has explicitly authorized the sender and completed the
required Resend/DNS verification. Never rename `RESEND_API_KEY` to a
`NEXT_PUBLIC_*` variable.

Production mail delivery is unavailable when `RESEND_API_KEY` or `EMAIL_FROM`
is missing. Public forgot-password requests retain a generic response and no
reset credential is created when delivery is unavailable. Development and test
use a one-time browser preview link instead of sending real mail; production
responses never contain the raw token or preview URL.

## Local demo configuration

Demo behavior is opt-in with two independent settings:

```dotenv
NEXT_PUBLIC_DEMO_MODE="true"
DEMO_STUDENT_PASSWORD_LOGIN_ENABLED="true"
```

The first displays the three Quick Login buttons in a non-production build. The
second permits only development/test password authentication for seeded
`LEGACY_PROTOTYPE` or legacy verified Student fixtures. Production ignores both
demo gates. Driver and Admin password authentication does not depend on either
demo setting.

Keep both values `false` in normal production. The seeded Student accounts are
development fixtures and intentionally have no fake Google external identity.

## Database deployment prerequisite

The repository migration adding nullable Student passwords,
`GOOGLE_WORKSPACE_VERIFIED`, and `ExternalAuthIdentity` must be reviewed and
deployed through the project's controlled migration process before enabling
Google Student sign-in against a shared environment. Do not use `prisma db push`,
reset the shared database, or run the destructive demo seed during deployment.
