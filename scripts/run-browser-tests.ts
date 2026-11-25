import { createServer } from "node:net";

import { runFixtureCommand, withDisposablePostgres } from "./disposable-postgres";
import { verifyTestDatabaseEnvironment } from "./verify-test-database";

async function selectLoopbackPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer().once("error", reject).listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error || !address || typeof address === "string") reject(new Error("Fixture app port unavailable"));
        else resolve(address.port);
      });
    });
  });
}

void withDisposablePostgres(async ({ environment }) => {
  const env = environment();
  await verifyTestDatabaseEnvironment(env);
  runFixtureCommand(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
  runFixtureCommand(process.execPath, ["--import", "tsx", "prisma/seed.ts"], env);

  const port = await selectLoopbackPort();
  runFixtureCommand(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
    ...env,
    NODE_ENV: "development",
    FYP_FIXTURE_APP_PORT: String(port),
    APP_BASE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_DEMO_MODE: "true",
    DEMO_STUDENT_PASSWORD_LOGIN_ENABLED: "true",
  });
}).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
