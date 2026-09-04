import type { ProductPolicy } from "@/shared/config/policies";
import { formatMytTime } from "@/shared/time/operational-time";

export type ServiceBlockContinuityStatus =
  | "CONTINUOUS_OK"
  | "TURNAROUND_TOO_SHORT"
  | "DEADHEAD_REQUIRED"
  | "DEADHEAD_TIME_INSUFFICIENT";

export interface ServiceBlockContinuity {
  readonly status: ServiceBlockContinuityStatus;
  readonly gapMinutes: number;
  readonly minimumTurnaroundMinutes: number;
  readonly message: string;
}

export interface ContinuityTrip {
  readonly departureTime: Date;
  readonly estimatedArrivalTime: Date;
  readonly tripStops: readonly {
    readonly stopId: string;
    readonly stopName?: string;
    readonly position: number;
  }[];
}

export interface BusTransitionTrip extends ContinuityTrip {
  readonly busId: string;
}

export function evaluateAdjacentBusTransition(
  previousTrip: BusTransitionTrip,
  nextTrip: BusTransitionTrip,
  policy: Pick<ProductPolicy, "minimumServiceBlockTurnaroundMs">,
): ServiceBlockContinuity | null {
  if (previousTrip.busId !== nextTrip.busId) return null;
  return evaluateServiceBlockContinuity(previousTrip, nextTrip, policy);
}

export function evaluateServiceBlockContinuity(
  previousTrip: ContinuityTrip,
  nextTrip: ContinuityTrip,
  policy: Pick<ProductPolicy, "minimumServiceBlockTurnaroundMs">,
): ServiceBlockContinuity {
  const previousStops = [...previousTrip.tripStops].sort(
    (left, right) => left.position - right.position,
  );
  const nextStops = [...nextTrip.tripStops].sort(
    (left, right) => left.position - right.position,
  );
  const previousTerminal = previousStops.at(-1);
  const nextOrigin = nextStops[0];
  const gapMs =
    nextTrip.departureTime.getTime() - previousTrip.estimatedArrivalTime.getTime();
  const gapMinutes = Math.floor(gapMs / 60_000);
  const minimumTurnaroundMinutes = Math.ceil(
    policy.minimumServiceBlockTurnaroundMs / 60_000,
  );
  const previousName = previousTerminal?.stopName ?? "the previous terminal";
  const nextName = nextOrigin?.stopName ?? "the next origin";
  const timeContext = `Previous Trip reaches ${previousName} at ${formatMytTime(previousTrip.estimatedArrivalTime)} MYT. Next Trip begins ${nextName} at ${formatMytTime(nextTrip.departureTime)} MYT.`;

  if (previousTerminal && nextOrigin && previousTerminal.stopId === nextOrigin.stopId) {
    if (gapMs >= policy.minimumServiceBlockTurnaroundMs) {
      return {
        status: "CONTINUOUS_OK",
        gapMinutes,
        minimumTurnaroundMinutes,
        message: `${timeContext} The ${gapMinutes}-minute layover meets the ${minimumTurnaroundMinutes}-minute prototype minimum.`,
      };
    }
    return {
      status: "TURNAROUND_TOO_SHORT",
      gapMinutes,
      minimumTurnaroundMinutes,
      message: `${timeContext} Allow at least ${minimumTurnaroundMinutes} minutes to unload, prepare and board.`,
    };
  }

  if (gapMs < policy.minimumServiceBlockTurnaroundMs) {
    return {
      status: "DEADHEAD_TIME_INSUFFICIENT",
      gapMinutes,
      minimumTurnaroundMinutes,
      message: `${timeContext} This sequence requires repositioning and the available gap may be operationally insufficient; exact deadhead travel time is not configured.`,
    };
  }
  return {
    status: "DEADHEAD_REQUIRED",
    gapMinutes,
    minimumTurnaroundMinutes,
    message: `${timeContext} Repositioning is required; confirm travel time operationally because no authoritative deadhead duration is configured.`,
  };
}
