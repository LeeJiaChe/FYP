import "server-only";

import { randomUUID } from "node:crypto";

import type { z } from "zod";

import { validationError } from "@/shared/application/application-error";
import { mapErrorToHttp } from "@/shared/http/error-response";
import { assertSameOriginMutation } from "@/shared/http/origin-check";

const DEFAULT_MAX_JSON_BYTES = 1_000_000;

export interface RouteResult<T> {
  readonly body: T;
  readonly status?: number;
  readonly headers?: HeadersInit;
}

export interface HandleRouteOptions {
  /**
   * Cookie-authenticated browser mutations use `same-origin` (the default).
   * `trusted-service` is only for machine endpoints that authenticate their own
   * service credential inside the invoked use case.
   */
  readonly originPolicy?: "same-origin" | "trusted-service";
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw validationError("Content-Type must be application/json");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw validationError("JSON request body is too large");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw validationError("Request body must contain valid JSON");
  }

  return schema.parse(value);
}

export async function handleRoute<T>(
  request: Request,
  operation: () => Promise<RouteResult<T>>,
  options: HandleRouteOptions = {},
): Promise<Response> {
  const requestId = randomUUID();

  try {
    if (options.originPolicy !== "trusted-service") {
      assertSameOriginMutation(request);
    }

    const result = await operation();
    const response = Response.json(result.body, {
      status: result.status ?? 200,
      headers: result.headers,
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    const mapped = mapErrorToHttp(error, requestId);
    if (mapped.unexpected) {
      console.error("Unexpected Route Handler error", { requestId, error });
    }

    const response = Response.json(mapped.body, { status: mapped.status });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
