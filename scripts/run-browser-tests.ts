import { spawn } from "node:child_process";
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
  let realtimePort = await selectLoopbackPort();
  if (realtimePort === port) realtimePort = await selectLoopbackPort();
  const environmentForApp = {
    ...env,
    NODE_ENV: "development",
    FYP_FIXTURE_APP_PORT: String(port),
    APP_BASE_URL: `http://127.0.0.1:${port}`,
    REALTIME_HOST: "127.0.0.1",
    REALTIME_PORT: String(realtimePort),
    REALTIME_URL: `http://127.0.0.1:${realtimePort}`,
    NEXT_PUBLIC_REALTIME_URL: `http://127.0.0.1:${realtimePort}`,
    CORS_ORIGIN: `http://127.0.0.1:${port}`,
    NEXTJS_INTERNAL_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_DEMO_MODE: "true",
    DEMO_STUDENT_PASSWORD_LOGIN_ENABLED: "true",
  };
  if (!process.argv.includes("--demo")) {
    runFixtureCommand(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], environmentForApp);
    return;
  }

  console.log(`Isolated demo: http://127.0.0.1:${port} (Ctrl+C to stop)`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/start-fixture-app.ts"], {
      env: { ...environmentForApp, RUN_SCHEDULED_JOBS: "true" },
      stdio: "inherit",
    });
    let shuttingDown = false;
    const stop = () => {
      shuttingDown = true;
      child.kill("SIGTERM");
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const cleanUpSignals = () => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    };
    child.once("error", (error) => {
      cleanUpSignals();
      reject(error);
    });
    child.once("exit", (code) => {
      cleanUpSignals();
      if (shuttingDown || code === 0) resolve();
      else reject(new Error("The isolated demo exited unexpectedly"));
    });
  });
}).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
