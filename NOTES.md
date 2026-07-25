# Project Assumptions & Design Decisions (NOTES.md)

1. **Database Provider**: Using SQLite with Prisma ORM (`file:./dev.db`) for zero-dependency local execution. The schema adheres 100% to the specification entities and field names.
2. **Realtime Service**: Standalone Node.js service running in `/realtime` using Express and Socket.io. Next.js API routes trigger realtime broadcasts via HTTP requests to `http://localhost:4000/emit`.
3. **Scheduled Cron Jobs**: Handled by `node-cron` running inside the `/realtime` service on a 1-minute interval. It triggers no-show detection and device health simulation routines via internal API endpoints.
4. **Auth & Tokens**: JWT tokens stored in `fyp_session` HTTP-only cookie. Student dynamic QR codes embed a 60-second signed JWT containing `{ bookingId, seatId, tripId }`, auto-refreshed by the frontend every 45 seconds.
5. **IoT Simulation**: Device health logs (`DeviceStatusLog`) are periodically simulated with occasional `OFFLINE` / `ERROR` signals to demonstrate sensor monitoring on the admin seat matrix.
