export interface WaitlistCandidate {
  readonly id: string;
  readonly queuedAt: Date;
}

export function oldestCompatibleWaitlistEntry<T extends WaitlistCandidate>(
  entries: readonly T[],
  isCompatible: (entry: T) => boolean,
): T | undefined {
  return [...entries]
    .sort(
      (left, right) =>
        left.queuedAt.getTime() - right.queuedAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .find(isCompatible);
}
