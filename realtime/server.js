const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");

const PORT = process.env.REALTIME_PORT || 4000;
const REALTIME_SECRET = process.env.REALTIME_SERVICE_SECRET || "fyp-realtime-secret-key";

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    return;
  }

  // HTTP POST /emit endpoint for Next.js backend to push realtime events
  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const { room, event, data, secret } = payload;

        if (secret !== REALTIME_SECRET && process.env.NODE_ENV === "production") {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        if (room) {
          io.to(room).emit(event || "update", data);
        } else {
          io.emit(event || "update", data);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, room, event }));
      } catch (err) {
        console.error("Error processing /emit payload:", err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[Realtime Service] Client connected: ${socket.id}`);

  // Allow clients to join trip room
  socket.on("join-trip", (tripId) => {
    const room = `trip:${tripId}`;
    socket.join(room);
    console.log(`[Realtime Service] Client ${socket.id} joined room ${room}`);
  });

  socket.on("leave-trip", (tripId) => {
    const room = `trip:${tripId}`;
    socket.leave(room);
    console.log(`[Realtime Service] Client ${socket.id} left room ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Realtime Service] Client disconnected: ${socket.id}`);
  });
});

// Scheduled cron job (every 1 minute) to process no-shows and simulate IoT signals
cron.schedule("* * * * *", async () => {
  try {
    const nextjsHost = process.env.NEXTJS_INTERNAL_URL || "http://localhost:3000";
    
    // Trigger no-show detection
    fetch(`${nextjsHost}/api/admin/cron/no-show`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": REALTIME_SECRET,
      },
    }).catch(() => {});

    // Trigger IoT device health simulation
    fetch(`${nextjsHost}/api/admin/cron/device-health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": REALTIME_SECRET,
      },
    }).catch(() => {});
  } catch (err) {
    // Ignore fetch errors if Next.js server is starting up
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Standalone Socket.io Realtime Service listening on port ${PORT}`);
});
