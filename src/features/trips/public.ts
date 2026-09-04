export {
  assertTripTransition,
  type TripLifecycleStatus,
} from "./domain/trip-status";
export {
  canEditSchedule,
  hasPassengerState,
  intervalsOverlap,
} from "./domain/scheduling-policy";
export {
  currentOperationalSegmentPosition,
  operationalProgressLabel,
} from "./domain/operational-segment";
export {
  resolveDriverOperation,
  type DriverOperationCandidate,
  type ResolvedDriverOperation,
} from "./domain/driver-operation";
export {
  evaluateServiceBlockContinuity,
  type ServiceBlockContinuity,
} from "./domain/service-block-continuity";
export {
  resolveStudentTrackingState,
  type StudentTrackingState,
} from "./domain/student-tracking-eligibility";
export {
  resolveAdminMonitoredTripId,
  selectAdminActiveTrips,
  type AdminLiveTripCandidate,
} from "./domain/admin-live-operation";
