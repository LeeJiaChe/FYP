export type {
  CreateBusInput,
  CreateRouteInput,
  CreateStopInput,
  UpdateBusInput,
  UpdateRouteInput,
  UpdateStopInput,
} from "./contracts/fleet.schemas";
export {
  assertBusStatusTransition,
  canScheduleBus,
  unavailableBusCancelsFutureTrips,
  type FleetBusStatus,
} from "./domain/asset-policy";
