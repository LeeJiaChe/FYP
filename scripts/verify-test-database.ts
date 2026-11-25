import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

import {
  assertFixtureIdentity,
  fixtureTarget,
  type FixtureDatabase,
} from "../src/shared/db/disposable-fixture";

export async function verifyTestDatabaseEnvironment(
  environment: NodeJS.ProcessEnv,
  database?: FixtureDatabase,
) {
  const target = fixtureTarget(environment, database);
  const client = new PrismaClient({ datasourceUrl: target.url });
  try {
    await assertFixtureIdentity(client, target);
    return { url: target.url, databaseName: target.databaseName };
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyTestDatabaseEnvironment(process.env).then(({ databaseName }) => {
    console.log(`Verified disposable PostgreSQL server and database: ${databaseName}`);
  }).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
