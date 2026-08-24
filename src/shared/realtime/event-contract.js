// Pure CommonJS contract shared by Next.js publishers and the standalone
// Socket.io process. Keep payloads minimal: events only signal clients to refetch.
const ALLOWED_REALTIME_EVENTS = Object.freeze([
  "trip.changed",
  "occupancy.changed",
  "location.changed",
  "notification.changed",
]);

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const TRIP_ROOM = new RegExp(`^trip:${UUID}$`, "i");
const USER_ROOM = new RegExp(`^user:${UUID}$`, "i");

/** @param {unknown} value */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} room */
function isAllowedRealtimeRoom(room) {
  return typeof room === "string" &&
    (TRIP_ROOM.test(room) || USER_ROOM.test(room) || room === "admins");
}

/** @param {unknown} event */
function isAllowedRealtimeEvent(event) {
  return typeof event === "string" && ALLOWED_REALTIME_EVENTS.includes(event);
}

/** @param {unknown} payload */
function isMinimalRealtimePayload(payload) {
  if (!isPlainObject(payload)) return false;
  const record = /** @type {Record<string, unknown>} */ (payload);
  const keys = Object.keys(record);
  if (keys.some((key) => !["entityId", "changedAt", "reason"].includes(key))) return false;
  if (typeof record.entityId !== "string" || record.entityId.length > 80) return false;
  if (typeof record.changedAt !== "string" || !Number.isFinite(Date.parse(record.changedAt))) return false;
  return record.reason === undefined ||
    (typeof record.reason === "string" && record.reason.length <= 80);
}

/** @param {unknown} room @param {unknown} event @param {unknown} data */
function isValidRealtimeEmission(room, event, data) {
  if (!isAllowedRealtimeRoom(room) || !isAllowedRealtimeEvent(event) || !isMinimalRealtimePayload(data)) {
    return false;
  }
  if (room.startsWith("trip:")) {
    return event === "trip.changed" || event === "occupancy.changed" || event === "location.changed";
  }
  return event === "notification.changed";
}

module.exports = {
  ALLOWED_REALTIME_EVENTS,
  isAllowedRealtimeRoom,
  isAllowedRealtimeEvent,
  isMinimalRealtimePayload,
  isValidRealtimeEmission,
};

