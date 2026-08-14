import { forbidden } from "@/shared/application/application-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Headers;
}

function firstForwardedValue(value: string | null): string | undefined {
  return value?.split(",", 1)[0]?.trim() || undefined;
}

export function requestPublicOrigin(request: OriginRequest): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? request.headers.get("host") ?? requestUrl.host;
  const forwardedProtocol = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );
  const protocol = forwardedProtocol ?? requestUrl.protocol.replace(":", "");

  if (!/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) {
    throw forbidden("Request host is invalid");
  }
  if (protocol !== "http" && protocol !== "https") {
    throw forbidden("Request protocol is invalid");
  }

  return new URL(`${protocol}://${host}`).origin;
}

export function assertSameOriginMutation(request: OriginRequest): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const originHeader = request.headers.get("origin");
  if (!originHeader || originHeader === "null") {
    throw forbidden("Mutation requests require an Origin header");
  }

  let suppliedOrigin: string;
  try {
    suppliedOrigin = new URL(originHeader).origin;
  } catch {
    throw forbidden("Mutation request Origin is invalid");
  }

  if (suppliedOrigin !== requestPublicOrigin(request)) {
    throw forbidden("Cross-origin mutation rejected");
  }
}
