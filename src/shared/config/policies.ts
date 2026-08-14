export interface ProductPolicy {
  readonly bookingOpenLeadMs: number;
  readonly reservedCancellationLeadMs: number;
  readonly boardingOpenLeadMs: number;
  readonly normalBoardingCloseGraceMs: number;
  readonly qrTokenLifetimeSeconds: number;
  readonly initialCredit: number;
  readonly noShowPenaltyPoints: number;
  readonly bookingRestrictionBelowCredit: number;
  readonly gpsSimulatorIntervalMs: number;
  readonly locationRetentionMs: number;
}

const MINUTE_MS = 60 * 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const defaultValues: ProductPolicy = {
  bookingOpenLeadMs: 7 * DAY_MS,
  reservedCancellationLeadMs: 30 * MINUTE_MS,
  boardingOpenLeadMs: 15 * MINUTE_MS,
  normalBoardingCloseGraceMs: 5 * MINUTE_MS,
  qrTokenLifetimeSeconds: 60,
  initialCredit: 100,
  noShowPenaltyPoints: 15,
  bookingRestrictionBelowCredit: 40,
  gpsSimulatorIntervalMs: 5_000,
  locationRetentionMs: 7 * DAY_MS,
};

export function createProductPolicy(
  overrides: Partial<ProductPolicy> = {},
): Readonly<ProductPolicy> {
  const policy = { ...defaultValues, ...overrides };
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }

  if (policy.qrTokenLifetimeSeconds === 0) {
    throw new RangeError("qrTokenLifetimeSeconds must be greater than zero");
  }
  if (policy.gpsSimulatorIntervalMs === 0) {
    throw new RangeError("gpsSimulatorIntervalMs must be greater than zero");
  }
  if (policy.locationRetentionMs === 0) {
    throw new RangeError("locationRetentionMs must be greater than zero");
  }

  return Object.freeze(policy);
}

export const productPolicy = createProductPolicy();
