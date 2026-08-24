import { z } from "zod";

const SECRET_MINIMUM_LENGTH = 32;
const TEST_DATABASE_CONFIRMATION = "FYP_BUS_INTEGRATION";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const postgresUrlSchema = z
  .string()
  .trim()
  .min(1)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }, "must be a PostgreSQL URL");

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "must be an HTTP(S) URL");

const secretSchema = z.string().min(SECRET_MINIMUM_LENGTH);

function databaseIdentity(url: URL): string {
  return `${url.protocol}//${url.hostname}:${url.port}/${decodeURIComponent(
    url.pathname.slice(1),
  )}`;
}

const rawServerEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrlSchema,
    JWT_SECRET: secretSchema,
    QR_SECRET: secretSchema,
    REALTIME_URL: httpUrlSchema,
    REALTIME_SERVICE_SECRET: secretSchema,
    TEST_DATABASE_URL: postgresUrlSchema.optional(),
    TEST_DATABASE_CONFIRM: z.string().optional(),
  })
  .superRefine((environment, context) => {
    const secrets = [
      ["JWT_SECRET", environment.JWT_SECRET],
      ["QR_SECRET", environment.QR_SECRET],
      ["REALTIME_SERVICE_SECRET", environment.REALTIME_SERVICE_SECRET],
    ] as const;

    for (let left = 0; left < secrets.length; left += 1) {
      for (let right = left + 1; right < secrets.length; right += 1) {
        if (secrets[left]?.[1] === secrets[right]?.[1]) {
          context.addIssue({
            code: "custom",
            path: [secrets[right]?.[0] ?? "secret"],
            message: "must be distinct from every other signing/service secret",
          });
        }
      }
    }

    const hasTestUrl = environment.TEST_DATABASE_URL !== undefined;
    const hasTestConfirmation = environment.TEST_DATABASE_CONFIRM !== undefined;
    if (hasTestUrl !== hasTestConfirmation) {
      context.addIssue({
        code: "custom",
        path: [hasTestUrl ? "TEST_DATABASE_CONFIRM" : "TEST_DATABASE_URL"],
        message: "must be provided together with the other test database setting",
      });
    }

    if (
      environment.TEST_DATABASE_CONFIRM !== undefined &&
      environment.TEST_DATABASE_CONFIRM !== TEST_DATABASE_CONFIRMATION
    ) {
      context.addIssue({
        code: "custom",
        path: ["TEST_DATABASE_CONFIRM"],
        message: `must equal ${TEST_DATABASE_CONFIRMATION}`,
      });
    }

    if (environment.TEST_DATABASE_URL !== undefined) {
      const testDatabase = new URL(environment.TEST_DATABASE_URL);
      const databaseName = decodeURIComponent(testDatabase.pathname.slice(1));
      if (!/(?:^|_)test$/.test(databaseName)) {
        context.addIssue({
          code: "custom",
          path: ["TEST_DATABASE_URL"],
          message: "database name must end in _test",
        });
      }

      if (
        databaseIdentity(testDatabase) ===
        databaseIdentity(new URL(environment.DATABASE_URL))
      ) {
        context.addIssue({
          code: "custom",
          path: ["TEST_DATABASE_URL"],
          message: "must differ from DATABASE_URL",
        });
      }
    }
  });

export interface ServerEnvironment {
  readonly runtime: "development" | "test" | "production";
  readonly database: {
    readonly url: string;
  };
  readonly session: {
    readonly signingSecret: string;
  };
  readonly qr: {
    readonly signingSecret: string;
  };
  readonly realtime: {
    readonly serviceUrl: string;
    readonly serviceSecret: string;
  };
  readonly integrationTest: {
    readonly databaseUrl?: string;
    readonly confirmed: boolean;
  };
}

export class ServerEnvironmentValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid server environment:\n- ${problems.join("\n- ")}`);
    this.name = "ServerEnvironmentValidationError";
  }
}

export function parseServerEnvironment(
  source: EnvironmentSource,
): ServerEnvironment {
  const result = rawServerEnvironmentSchema.safeParse(source);
  if (!result.success) {
    throw new ServerEnvironmentValidationError(
      result.error.issues.map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const environment = result.data;
  return Object.freeze({
    runtime: environment.NODE_ENV,
    database: Object.freeze({ url: environment.DATABASE_URL }),
    session: Object.freeze({ signingSecret: environment.JWT_SECRET }),
    qr: Object.freeze({ signingSecret: environment.QR_SECRET }),
    realtime: Object.freeze({
      serviceUrl: environment.REALTIME_URL.replace(/\/$/, ""),
      serviceSecret: environment.REALTIME_SERVICE_SECRET,
    }),
    integrationTest: Object.freeze({
      databaseUrl: environment.TEST_DATABASE_URL,
      confirmed:
        environment.TEST_DATABASE_CONFIRM === TEST_DATABASE_CONFIRMATION,
    }),
  });
}
