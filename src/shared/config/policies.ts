import approvedDefaults from "./product-policy.defaults.json";

export interface ProductPolicy {
  readonly bookingOpenLeadMs: number;
  readonly boardingOpenLeadMs: number;
  readonly normalBoardingCloseGraceMs: number;
  readonly qrTokenLifetimeSeconds: number;
  readonly initialCredit: number;
  readonly noShowPenaltyPoints: number;
  readonly bookingRestrictionBelowCredit: number;
  readonly gpsSimulatorIntervalMs: number;
  readonly locationRetentionMs: number;
  readonly trafficEtaFailureCacheMs: number;
  readonly trafficEtaTimeoutMs: number;
  readonly trafficEtaMaxLocationAgeMs: number;
  readonly minimumServiceBlockTurnaroundMs: number;
  readonly importantDelayNotificationMinutes: number;
  readonly emailVerificationTtlMs: number;
  readonly googleOnboardingTtlMs: number;
  readonly passwordResetTtlMs: number;
}

const defaultValues: ProductPolicy = approvedDefaults;

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
  if (policy.trafficEtaFailureCacheMs === 0) {
    throw new RangeError("trafficEtaFailureCacheMs must be greater than zero");
  }
  if (policy.trafficEtaTimeoutMs === 0) {
    throw new RangeError("trafficEtaTimeoutMs must be greater than zero");
  }
  if (policy.trafficEtaMaxLocationAgeMs === 0) {
    throw new RangeError("trafficEtaMaxLocationAgeMs must be greater than zero");
  }
  if (policy.minimumServiceBlockTurnaroundMs === 0) {
    throw new RangeError("minimumServiceBlockTurnaroundMs must be greater than zero");
  }
  if (policy.importantDelayNotificationMinutes === 0) {
    throw new RangeError("importantDelayNotificationMinutes must be greater than zero");
  }
  if (policy.emailVerificationTtlMs === 0) {
    throw new RangeError("emailVerificationTtlMs must be greater than zero");
  }
  if (policy.googleOnboardingTtlMs === 0) {
    throw new RangeError("googleOnboardingTtlMs must be greater than zero");
  }
  if (policy.passwordResetTtlMs === 0) {
    throw new RangeError("passwordResetTtlMs must be greater than zero");
  }

  return Object.freeze(policy);
}

export const productPolicy = createProductPolicy();
