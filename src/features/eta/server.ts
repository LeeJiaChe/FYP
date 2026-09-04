import "server-only";

import {
  getOperationalTripEtaService,
  getStudentBookingEtaService,
  getTripEtaService,
  type EtaActor,
} from "./application/eta";

export {
  etaFallbackReasonSchema,
  etaSourceSchema,
  stopEtaSchema,
  studentBookingEtaSchema,
  tripEtaSchema,
  type EtaFallbackReason,
  type EtaSource,
  type StopEta,
  type StudentBookingEta,
  type TripEta,
} from "./contracts/eta.schemas";

export {
  calculateScheduleVarianceMinutes,
  calculateTrafficImpactMinutes,
  parseGoogleDurationSeconds,
} from "./domain/eta-policy";

export { type EtaActor } from "./application/eta";

export async function getTripEta(tripId: string) {
  return getTripEtaService({ tripId });
}

export async function getStudentBookingEta(actor: EtaActor, bookingId: string) {
  return getStudentBookingEtaService({ actor, bookingId });
}

export async function getOperationalTripEta(actor: EtaActor, tripId: string) {
  return getOperationalTripEtaService({ actor, tripId });
}
