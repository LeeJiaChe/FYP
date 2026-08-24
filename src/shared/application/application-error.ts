export type ApplicationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVARIANT_VIOLATION"
  | "INTERNAL";

export interface ApplicationErrorOptions {
  readonly details?: unknown;
  readonly cause?: unknown;
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly details?: unknown;

  constructor(
    code: ApplicationErrorCode,
    message: string,
    options: ApplicationErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApplicationError";
    this.code = code;
    this.details = options.details;
  }
}

export function unauthenticated(
  message = "Authentication is required",
): ApplicationError {
  return new ApplicationError("UNAUTHENTICATED", message);
}

export function forbidden(message = "Access is forbidden"): ApplicationError {
  return new ApplicationError("FORBIDDEN", message);
}

export function notFound(message = "Resource not found"): ApplicationError {
  return new ApplicationError("NOT_FOUND", message);
}

export function validationError(
  message = "Request validation failed",
  details?: unknown,
): ApplicationError {
  return new ApplicationError("VALIDATION", message, { details });
}

export function conflict(message = "Request conflicts with current state"): ApplicationError {
  return new ApplicationError("CONFLICT", message);
}

export function invariantViolation(
  message = "The requested operation violates a business invariant",
): ApplicationError {
  return new ApplicationError("INVARIANT_VIOLATION", message);
}

export function internalError(cause?: unknown): ApplicationError {
  return new ApplicationError("INTERNAL", "Internal server error", { cause });
}
