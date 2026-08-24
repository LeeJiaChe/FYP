export function utilizationPercent(usedSegments: number, capacitySegments: number): number {
  if (capacitySegments <= 0) return 0;
  return Math.round((usedSegments / capacitySegments) * 100);
}

export function noShowPercent(noShows: number, eligibleOutcomes: number): number {
  if (eligibleOutcomes <= 0) return 0;
  return Math.round((noShows / eligibleOutcomes) * 100);
}

