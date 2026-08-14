import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { verifyTestDatabaseEnvironment } from "./verify-test-database";

const verified = verifyTestDatabaseEnvironment(process.env);
const workspace = path.resolve(import.meta.dirname, "..");
const childEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
};

function run(command: string, args: readonly string[], environment = childEnvironment) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write(
  `Resetting isolated PostgreSQL integration database: ${verified.databaseName}\n`,
);
run(
  process.execPath,
  [
    path.join(workspace, "node_modules/prisma/build/index.js"),
    "migrate",
    "reset",
    "--force",
    "--skip-seed",
  ],
  { ...childEnvironment, DATABASE_URL: verified.url },
);

process.stdout.write("Verifying PostgreSQL migration status\n");
run(
  process.execPath,
  [path.join(workspace, "node_modules/prisma/build/index.js"), "migrate", "status"],
  { ...childEnvironment, DATABASE_URL: verified.url },
);

const testFiles = readdirSync(path.join(workspace, "tests/integration"))
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join("tests/integration", file));

run(process.execPath, [
  "--conditions=react-server",
  "--import",
  "tsx",
  "--test",
  ...testFiles,
]);
