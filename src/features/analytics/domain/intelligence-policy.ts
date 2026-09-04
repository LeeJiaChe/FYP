export const analyticsIntelligencePolicy = Object.freeze({
  minimumOperationalSample: 3,
  highEvidenceSample: 10,
  capacityPressurePercent: 80,
  severeCapacityPressurePercent: 90,
  reliabilityTargetPercent: 80,
  materialPercentagePointChange: 10,
  noShowWatchPercent: 10,
  severeUnservedDemand: 5,
  unservedDemandSpikeCount: 3,
  materialDemandChangePercent: 20,
  highFleetConcentrationPercent: 50,
  significantExpectedDelayMinutes: 10,
});

export type AnalyticsIntelligencePolicy = typeof analyticsIntelligencePolicy;
