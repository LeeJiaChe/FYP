import { spawn } from "node:child_process";

import { verifyTestDatabaseEnvironment } from "./verify-test-database";

void verifyTestDatabaseEnvironment(process.env).then(() => {
  const port = process.env.FYP_FIXTURE_APP_PORT;
  if (!port || !/^\d{4,5}$/.test(port) || Number(port) > 65535) {
    throw new Error("A dedicated fixture app port is required");
  }
  const child = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", port,
  ], { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => child.kill(signal));
  }
  child.once("exit", (code) => { process.exitCode = code ?? 1; });
}).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
