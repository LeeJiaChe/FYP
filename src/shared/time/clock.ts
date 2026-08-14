export interface Clock {
  now(): Date;
}

export const systemClock: Clock = Object.freeze({
  now: () => new Date(),
});

export function fixedClock(instant: Date | string | number): Clock {
  const timestamp = new Date(instant).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new RangeError("Fixed clock instant must be a valid date/time");
  }

  return Object.freeze({
    now: () => new Date(timestamp),
  });
}
