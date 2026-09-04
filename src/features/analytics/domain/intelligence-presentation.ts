import type { TimeBucketIntelligenceRow } from "../contracts/intelligence.schemas";

export type DemandHeatMetric =
  | "boardedPassengers"
  | "reservedSeatSegmentUtilization"
  | "unservedDemand";

export function demandHeatValue(
  row: TimeBucketIntelligenceRow,
  metric: DemandHeatMetric,
): number | null {
  return row[metric];
}

export function demandHeatMaximum(
  rows: readonly TimeBucketIntelligenceRow[],
  metric: DemandHeatMetric,
): number {
  const values = rows
    .map((row) => demandHeatValue(row, metric))
    .filter((value): value is number => value !== null);
  return Math.max(1, ...values);
}

export function formatAnalyticsDelta(
  value: number | null,
  unit = "",
): string {
  if (value === null) return "No comparable baseline";
  if (value === 0) return "No change vs previous period";
  return `${value > 0 ? "+" : ""}${value}${unit} vs previous period`;
}
