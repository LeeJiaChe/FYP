export const OPERATIONAL_TIME_ZONE = "Asia/Kuala_Lumpur";

const serviceDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date-time");
  return date;
}

export function toMytServiceDateKey(value: string | Date): string {
  const parts = serviceDateFormatter.formatToParts(validDate(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getMytHour(value: string | Date): number {
  const parts = new Intl.DateTimeFormat("en-MY", {
    timeZone: OPERATIONAL_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(validDate(value));
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
}

export function mytServiceDayBounds(serviceDate: string): {
  readonly startUtc: Date;
  readonly endUtcExclusive: Date;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!match) throw new RangeError("Service date must use YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid service date");
  }

  // Malaysia is UTC+08:00 year-round; its midnight is 16:00 UTC on the
  // previous Gregorian day. Date.UTC handles month/year rollover here.
  return {
    startUtc: new Date(Date.UTC(year, month - 1, day, -8)),
    endUtcExclusive: new Date(Date.UTC(year, month - 1, day + 1, -8)),
  };
}

export function formatMytTime(value: string | Date): string {
  const formatted = new Intl.DateTimeFormat("en-MY", {
    timeZone: OPERATIONAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(validDate(value));
  return formatted.replace(/^24:/, "00:");
}

export function formatMytDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  },
): string {
  return new Intl.DateTimeFormat("en-MY", {
    ...options,
    timeZone: OPERATIONAL_TIME_ZONE,
  }).format(validDate(value));
}

export function formatMytDateTime(value: string | Date): string {
  const formatted = new Intl.DateTimeFormat("en-MY", {
    timeZone: OPERATIONAL_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(validDate(value));
  return formatted.replace(/\b24:/, "00:");
}
