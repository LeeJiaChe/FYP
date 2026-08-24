export const TEST_DATABASE_CONFIRMATION = "FYP_BUS_INTEGRATION";
const TEST_DATABASE_SUFFIX = /(?:^|_)test$/;

export interface VerifiedTestDatabase {
  readonly url: string;
  readonly databaseName: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

function databaseIdentity(url: URL): string {
  return `${url.protocol}//${url.hostname}:${url.port}/${decodeURIComponent(
    url.pathname.replace(/^\//, ""),
  )}`;
}

export function verifyTestDatabaseEnvironment(
  environment: Environment,
): VerifiedTestDatabase {
  const rawTestUrl = environment.TEST_DATABASE_URL?.trim();
  if (!rawTestUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required; integration tests never fall back to DATABASE_URL",
    );
  }

  let testUrl: URL;
  try {
    testUrl = new URL(rawTestUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (testUrl.protocol !== "postgresql:" && testUrl.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use PostgreSQL, never SQLite");
  }

  const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\//, ""));
  if (!TEST_DATABASE_SUFFIX.test(databaseName)) {
    throw new Error(
      `Integration database name must end in _test; received ${databaseName || "<empty>"}`,
    );
  }

  const rawDevelopmentUrl = environment.DATABASE_URL?.trim();
  if (rawDevelopmentUrl) {
    let developmentUrl: URL;
    try {
      developmentUrl = new URL(rawDevelopmentUrl);
    } catch {
      throw new Error("DATABASE_URL is invalid; refusing an ambiguous test run");
    }

    if (
      databaseIdentity(developmentUrl) === databaseIdentity(testUrl)
    ) {
      throw new Error(
        "TEST_DATABASE_URL must not equal the normal development DATABASE_URL",
      );
    }
  }

  if (environment.TEST_DATABASE_CONFIRM !== TEST_DATABASE_CONFIRMATION) {
    throw new Error(
      `Set TEST_DATABASE_CONFIRM=${TEST_DATABASE_CONFIRMATION} to acknowledge the isolated test target`,
    );
  }

  return { url: testUrl.toString(), databaseName };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const verified = verifyTestDatabaseEnvironment(process.env);
    process.stdout.write(
      `Verified isolated PostgreSQL integration database: ${verified.databaseName}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Integration database safety check failed: ${message}\n`);
    process.exitCode = 1;
  }
}
