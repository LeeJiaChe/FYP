import { spawn } from "node:child_process";

import { verifyTestDatabaseEnvironment } from "./verify-test-database";

void verifyTestDatabaseEnvironment(process.env).then(async () => {
  const port = process.env.FYP_FIXTURE_APP_PORT;
  const realtimePort = process.env.REALTIME_PORT;
  const validPort = (value: string | undefined): value is string =>
    Boolean(value && /^\d{4,5}$/.test(value) && Number(value) <= 65535);
  if (!validPort(port) || !validPort(realtimePort) || port === realtimePort ||
    process.env.REALTIME_HOST !== "127.0.0.1" ||
    process.env.NEXTJS_INTERNAL_URL !== `http://127.0.0.1:${port}` ||
    process.env.REALTIME_URL !== `http://127.0.0.1:${realtimePort}`) {
    throw new Error("Fixture application and realtime require distinct private loopback endpoints");
  }

  const realtime = spawn(process.execPath, ["realtime/server.js"], { stdio: "inherit" });
  const app = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", port,
  ], { stdio: "inherit" });

  function stop(signal: NodeJS.Signals = "SIGTERM") {
    if (app.exitCode === null) app.kill(signal);
    if (realtime.exitCode === null) realtime.kill(signal);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => stop(signal));
  }
  for (const child of [app, realtime]) {
    child.once("exit", (code) => {
      stop();
      process.exitCode = code ?? 1;
    });
    child.once("error", () => {
      stop();
      process.exitCode = 1;
    });
  }
}).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
