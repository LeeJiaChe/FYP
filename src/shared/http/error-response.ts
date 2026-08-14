import { z } from "zod";

import {
  ApplicationError,
  type ApplicationErrorCode,
} from "@/shared/application/application-error";

const statusByCode: Readonly<Record<ApplicationErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  INVARIANT_VIOLATION: 422,
  INTERNAL: 500,
};

export interface ErrorResponseBody {
  readonly error: {
    readonly code: ApplicationErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly details?: unknown;
  };
}

export interface ErrorHttpMapping {
  readonly status: number;
  readonly body: ErrorResponseBody;
  readonly unexpected: boolean;
}

export function mapErrorToHttp(
  error: unknown,
  requestId: string,
): ErrorHttpMapping {
  if (error instanceof z.ZodError) {
    return {
      status: statusByCode.VALIDATION,
      unexpected: false,
      body: {
        error: {
          code: "VALIDATION",
          message: "Request validation failed",
          requestId,
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    };
  }

  if (error instanceof ApplicationError) {
    const internal = error.code === "INTERNAL";
    return {
      status: statusByCode[error.code],
      unexpected: internal,
      body: {
        error: {
          code: error.code,
          message: internal ? "Internal server error" : error.message,
          requestId,
          ...(internal || error.details === undefined
            ? {}
            : { details: error.details }),
        },
      },
    };
  }

  return {
    status: 500,
    unexpected: true,
    body: {
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        requestId,
      },
    },
  };
}
