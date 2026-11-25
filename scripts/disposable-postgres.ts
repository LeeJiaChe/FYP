import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  FIXTURE_CONFIRMATION,
  FIXTURE_DATABASE,
  FIXTURE_ROLE,
  UPGRADE_DATABASE,
  fixtureUrl,
  type FixtureDatabase,
} from "../src/shared/db/disposable-fixture";

const inherited: NodeJS.ProcessEnv = { NODE_ENV: "test", ...Object.fromEntries(
  ["PATH", "HOME", "LANG", "LC_ALL", "CI", "PLAYWRIGHT_BROWSERS_PATH"].flatMap((key) =>
    process.env[key] ? [[key, process.env[key]]] : [],
  ),
) };

export function runFixtureCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  options: { quiet?: boolean; input?: string } = {},
) {
  const result = spawnSync(command, args, {
    env,
    input: options.input,
    encoding: "utf8",
    stdio: [options.input ? "pipe" : "ignore", options.quiet ? "pipe" : "inherit", options.quiet ? "pipe" : "inherit"],
  });
  if (result.status !== 0 || result.error) {
    const sqlDiagnostic = path.basename(command) === "psql" ? result.stderr?.match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1] : undefined;
    if (sqlDiagnostic) console.error(`PostgreSQL fixture command failed with SQLSTATE ${sqlDiagnostic}`);
    throw new Error(`${path.basename(command)} ${args[0] ?? ""} failed (exit ${result.status ?? "unavailable"})`);
  }
  return result.stdout;
}

export async function withDisposablePostgres<T>(work: (fixture: {
  environment: (database?: FixtureDatabase) => NodeJS.ProcessEnv;
  sql: (statement: string, database?: FixtureDatabase) => string;
  version: string;
}) => Promise<T>): Promise<T> {
  const dotenvFiles = [".env", ".env.local", "prisma/.env",
    ...["development", "test", "production"].flatMap((mode) => [`.env.${mode}`, `.env.${mode}.local`]),
  ];
  if (dotenvFiles.some((file) => existsSync(file))) {
    throw new Error("Run disposable tests from a checkout without local dotenv credential files");
  }
  if (process.env.TEST_DATABASE_CONFIRM !== FIXTURE_CONFIRMATION) {
    throw new Error("Set TEST_DATABASE_CONFIRM=FYP_BUS_INTEGRATION to acknowledge disposable operations");
  }
  const binaryDir = runFixtureCommand("pg_config", ["--bindir"], inherited, { quiet: true }).trim();
  const root = mkdtempSync("/tmp/fyp-fixture-");
  const data = path.join(root, "data");
  const socket = path.join(root, "socket");
  const passwordFile = path.join(root, "bootstrap-password");
  const password = randomBytes(32).toString("hex");
  const nonce = randomBytes(32).toString("hex");
  const pg = (binary: string, args: string[], options?: { quiet?: boolean; input?: string }, env = inherited) =>
    runFixtureCommand(path.join(binaryDir, binary), args, env, options);

  function psql(statement: string, database: string) {
    return pg("psql", ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-At"], { quiet: true, input: statement }, {
      ...inherited, PGHOST: socket, PGPORT: "5432", PGUSER: FIXTURE_ROLE,
      PGPASSWORD: password, PGDATABASE: database, PGCONNECT_TIMEOUT: "3",
    }).trim();
  }

  let started = false;
  try {
    mkdirSync(socket, { mode: 0o700 });
    writeFileSync(passwordFile, password, { mode: 0o600 });
    writeFileSync(path.join(root, "proof"), `${password}\n${nonce}\n`, { mode: 0o600 });
    pg("initdb", ["-D", data, "-U", FIXTURE_ROLE, "--auth=scram-sha-256", "--pwfile", passwordFile, "--no-locale", "--encoding=UTF8"], { quiet: true });
    rmSync(passwordFile);
    pg("pg_ctl", ["start", "-D", data, "-w", "-t", "20", "-l", path.join(root, "postgres.log"),
      "-o", `-c listen_addresses='' -c unix_socket_directories=${socket} -c unix_socket_permissions=0700 -p 5432`], { quiet: true });
    started = true;
    for (const database of [FIXTURE_DATABASE, UPGRADE_DATABASE]) {
      psql(`CREATE DATABASE "${database}"`, "postgres");
      psql(`CREATE SCHEMA fyp_fixture_guard;
        CREATE TABLE fyp_fixture_guard.provisioning (nonce text PRIMARY KEY);
        INSERT INTO fyp_fixture_guard.provisioning VALUES ('${nonce}');`, database);
    }
    const version = psql("SHOW server_version", "postgres");
    console.log(`Provisioned disposable PostgreSQL ${version} in a private Unix-socket cluster`);

    return await work({
      version,
      sql: (statement, database = FIXTURE_DATABASE) => psql(statement, database),
      environment(database = FIXTURE_DATABASE) {
        const url = fixtureUrl(root, password, database);
        return {
          ...inherited,
          NODE_ENV: "test",
          DATABASE_URL: url,
          TEST_DATABASE_URL: url,
          TEST_DATABASE_CONFIRM: FIXTURE_CONFIRMATION,
          FYP_FIXTURE_ROOT: root,
          JWT_SECRET: randomBytes(32).toString("hex"),
          QR_SECRET: randomBytes(32).toString("hex"),
          REALTIME_SERVICE_SECRET: randomBytes(32).toString("hex"),
          REALTIME_URL: "http://127.0.0.1:1",
          NEXT_PUBLIC_REALTIME_URL: "http://127.0.0.1:1",
          RUN_SCHEDULED_JOBS: "false",
          NEXT_TELEMETRY_DISABLED: "1",
          GOOGLE_TRAFFIC_ETA_ENABLED: "false",
          GOOGLE_MAPS_ROUTES_API_KEY: "",
          NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "",
          GOOGLE_STUDENT_HOSTED_DOMAIN: "student.tarc.edu.my",
          NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
          GEMINI_OPERATIONS_ASSISTANT_ENABLED: "false",
          GEMINI_API_KEY: "",
          GEMINI_MODEL: "gemini-3.8-flash",
          RESEND_API_KEY: "",
          EMAIL_FROM: "",
          APP_BASE_URL: "http://127.0.0.1:3000",
          DEMO_STUDENT_PASSWORD_LOGIN_ENABLED: "false",
          NEXT_PUBLIC_DEMO_MODE: "false",
          FIXTURE_EMAIL_PREVIEW_ENABLED: "false",
        };
      },
    });
  } finally {
    if (started) pg("pg_ctl", ["stop", "-D", data, "-m", "fast", "-w", "-t", "20"], { quiet: true });
    rmSync(root, { recursive: true, force: true });
  }
}
