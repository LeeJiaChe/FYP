import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const FIXTURE_CONFIRMATION = "FYP_BUS_INTEGRATION";
export const FIXTURE_ROLE = "fyp_fixture";
export const FIXTURE_DATABASE = "fyp_bus_test";
export const UPGRADE_DATABASE = "fyp_upgrade_test";
export type FixtureDatabase = typeof FIXTURE_DATABASE | typeof UPGRADE_DATABASE;
type Environment = Readonly<Record<string, string | undefined>>;

export function fixtureUrl(root: string, password: string, database: FixtureDatabase) {
  const query = new URLSearchParams({
    host: path.join(root, "socket"),
    schema: "public",
    connect_timeout: "3",
  });
  return `postgresql://${FIXTURE_ROLE}:${password}@localhost:5432/${database}?${query}`;
}

export function fixtureTarget(environment: Environment, database: FixtureDatabase = FIXTURE_DATABASE) {
  if (environment.TEST_DATABASE_CONFIRM !== FIXTURE_CONFIRMATION) {
    throw new Error("Explicit disposable database acknowledgement is required");
  }
  const root = environment.FYP_FIXTURE_ROOT;
  if (!root || !/^\/tmp\/fyp-fixture-[a-zA-Z0-9]{6}$/.test(root)) {
    throw new Error("A provisioned private fixture directory is required");
  }

  let password: string;
  let nonce: string;
  try {
    for (const entry of [root, path.join(root, "socket"), path.join(root, "proof")]) {
      const metadata = lstatSync(entry);
      if (realpathSync(entry) !== entry || metadata.uid !== process.getuid?.() || (metadata.mode & 0o077) !== 0) {
        throw new Error("Fixture paths must be private and owned by the invoking user");
      }
    }
    [password = "", nonce = ""] = readFileSync(path.join(root, "proof"), "utf8").trim().split("\n");
  } catch {
    throw new Error("Fixture provisioning evidence is unavailable or ambiguous");
  }
  if (!/^[a-f0-9]{64}$/.test(password) || !/^[a-f0-9]{64}$/.test(nonce)) {
    throw new Error("Fixture provisioning evidence is invalid");
  }
  const url = fixtureUrl(root, password, database);
  if (environment.DATABASE_URL !== url || environment.TEST_DATABASE_URL !== url) {
    throw new Error("Both database settings must exactly match the provisioned fixture target");
  }
  return { url, root, nonce, databaseName: database };
}

type FixtureQuery = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export async function assertFixtureIdentity(
  client: FixtureQuery,
  target: ReturnType<typeof fixtureTarget>,
) {
  let verified: Array<{ matches: boolean }>;
  try {
    verified = await client.$queryRaw<Array<{ matches: boolean }>>`
      SELECT current_database() = ${target.databaseName}
        AND current_user = ${FIXTURE_ROLE}
        AND inet_server_addr() IS NULL
        AND current_setting('data_directory') = ${path.join(target.root, "data")}
        AND marker.nonce = ${target.nonce} AS matches
      FROM fyp_fixture_guard.provisioning marker
    `;
  } catch {
    throw new Error("Disposable PostgreSQL identity is unavailable");
  }
  if (verified.length !== 1 || !verified[0]?.matches) {
    throw new Error("PostgreSQL did not identify itself as the provisioned disposable fixture");
  }
}
