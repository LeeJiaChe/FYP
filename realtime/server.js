const { loadEnvConfig } = require("@next/env");

// This process runs outside Next.js, so load the same root .env files explicitly.
// Existing process variables still take precedence, matching Next.js development.
loadEnvConfig(process.cwd());

const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const cron = require("node-cron");
const {
  isAllowedRealtimeRoom,
  isValidRealtimeEmission,
} = require("../src/shared/realtime/event-contract.js");
const productPolicy = require("../src/shared/config/product-policy.defaults.json");

const MAX_EMIT_BYTES = 8_192;

function secretMatches(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  const supplied = Buffer.from(candidate);
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

function bearerToken(request) {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function verifySubscriptionToken(token, secret) {
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "fyp-nextjs",
      audience: "fyp-realtime",
    });
    if (!claims || claims.purpose !== "REALTIME_SUBSCRIPTION") return null;
    if (typeof claims.tripId !== "string" || typeof claims.userId !== "string") return null;
    if (!["STUDENT", "DRIVER", "ADMIN"].includes(claims.role)) return null;
    const room = `trip:${claims.tripId}`;
    return isAllowedRealtimeRoom(room) ? { ...claims, room } : null;
  } catch {
    return null;
  }
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readBoundedJson(request, maximumBytes = MAX_EMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maximumBytes) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        request.destroy();
        return;
      }
      body += chunk.toString();
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function createRealtimeService({ serviceSecret, corsOrigins }) {
  let io;
  const server = http.createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    if (requestOrigin && corsOrigins.includes(requestOrigin)) {
      response.setHeader("Access-Control-Allow-Origin", requestOrigin);
      response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (request.method === "OPTIONS") return json(response, 204, {});
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { status: "ok", timestamp: new Date().toISOString() });
    }
    if (request.method === "POST" && request.url === "/emit") {
      if (!secretMatches(bearerToken(request), serviceSecret)) {
        return json(response, 401, { error: "Unauthorized" });
      }
      try {
        const payload = await readBoundedJson(request);
        if (!isValidRealtimeEmission(payload.room, payload.event, payload.data)) {
          return json(response, 400, { error: "Invalid realtime emission contract" });
        }
        io.to(payload.room).emit(payload.event, payload.data);
        return json(response, 200, { success: true });
      } catch (error) {
        return json(response, error.status || 400, { error: error.message || "Invalid request" });
      }
    }
    return json(response, 404, { error: "Not found" });
  });

  io = new Server(server, {
    cors: { origin: corsOrigins, methods: ["GET", "POST"] },
    maxHttpBufferSize: MAX_EMIT_BYTES,
  });
  io.use((socket, next) => {
    const claims = verifySubscriptionToken(socket.handshake.auth?.token, serviceSecret);
    if (!claims) return next(new Error("Unauthorized realtime subscription"));
    socket.data.subscription = claims;
    return next();
  });
  io.on("connection", (socket) => {
    socket.join(socket.data.subscription.room);
  });
  return { server, io };
}

function postTrusted(nextjsHost, path, secret, headerName, body) {
  return fetch(`${nextjsHost}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [headerName]: secret,
    },
    body: JSON.stringify(body || {}),
  }).then((response) => {
    if (!response.ok && response.status !== 404) {
      console.error(`[Realtime Service] ${path} returned ${response.status}`);
    }
  }).catch((error) => {
    console.error(`[Realtime Service] ${path} unavailable:`, error.message);
  });
}

function startSchedulers({ nextjsHost, serviceSecret, simulatorIntervalMs }) {
  cron.schedule("* * * * *", () => {
    void postTrusted(nextjsHost, "/api/admin/cron/no-show", serviceSecret, "x-cron-secret");
  });
  cron.schedule("17 3 * * *", () => {
    void postTrusted(nextjsHost, "/api/admin/cron/location-retention", serviceSecret, "x-service-secret");
  });
  const simulator = setInterval(() => {
    void postTrusted(nextjsHost, "/api/location/simulate", serviceSecret, "x-service-secret");
  }, simulatorIntervalMs);
  simulator.unref();
}

if (require.main === module) {
  const port = Number(process.env.REALTIME_PORT || 4000);
  const serviceSecret = process.env.REALTIME_SERVICE_SECRET;
  const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!serviceSecret || serviceSecret.length < 32) {
    console.error("FATAL: REALTIME_SERVICE_SECRET must be at least 32 characters");
    process.exit(1);
  }
  const service = createRealtimeService({ serviceSecret, corsOrigins });
  startSchedulers({
    nextjsHost: process.env.NEXTJS_INTERNAL_URL || "http://localhost:3000",
    serviceSecret,
    simulatorIntervalMs: Number(
      process.env.GPS_SIMULATOR_INTERVAL_MS || productPolicy.gpsSimulatorIntervalMs,
    ),
  });
  service.server.listen(port, () => {
    console.log(`[Realtime Service] listening on port ${port}`);
  });
}

module.exports = {
  MAX_EMIT_BYTES,
  createRealtimeService,
  secretMatches,
  verifySubscriptionToken,
};
