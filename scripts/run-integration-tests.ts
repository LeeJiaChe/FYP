import { readdirSync } from "node:fs";

import { runFixtureCommand, withDisposablePostgres } from "./disposable-postgres";
import { verifyTestDatabaseEnvironment } from "./verify-test-database";

void withDisposablePostgres(async ({ environment }) => {
  const env = environment();
  await verifyTestDatabaseEnvironment(env);
  const prisma = "node_modules/prisma/build/index.js";
  runFixtureCommand(process.execPath, [prisma, "migrate", "deploy"], env);
  runFixtureCommand(process.execPath, [prisma, "migrate", "status"], env);
  const tests = readdirSync("tests/integration")
    .filter((file) => file.endsWith(".test.ts"))
    .sort()
    .map((file) => `tests/integration/${file}`);
  runFixtureCommand(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", ...tests], env);
}).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
