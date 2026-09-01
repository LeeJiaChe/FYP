import type {
  CreateBusInput,
  CreateRouteInput,
  CreateStopInput,
  UpdateBusInput,
  UpdateRouteInput,
  UpdateStopInput,
} from "../contracts/fleet.schemas";
import { RouteTopologyError } from "../domain/route-topology";
import {
  createRouteRecord,
  createBusRecord,
  createStopRecord,
  FleetPersistenceError,
  listBusesRecord,
  listActiveRoutesRecord,
  listActiveStopsRecord,
  retireRouteRecord,
  retireBusRecord,
  retireStopRecord,
  updateBusRecord,
  updateRouteRecord,
  updateStopRecord,
} from "../infrastructure/fleet.prisma.server";
import {
  conflict,
  forbidden,
  notFound,
  validationError,
} from "@/shared/application/application-error";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface FleetActor {
  readonly userId: string;
  readonly role: string;
}

function requireAdmin(actor: FleetActor): void {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
}

function topologyFailure(error: unknown): never {
  if (
    error instanceof RouteTopologyError ||
    (error instanceof Error && error.message === "ROUTE_CONTAINS_INACTIVE_STOP")
  ) {
    throw validationError(error.message.replace(/_/g, " ").toLowerCase());
  }
  throw error;
}

function stopDto(stop: {
  id: string;
  code: string;
  name: string;
  latitude: { toNumber(): number };
  longitude: { toNumber(): number };
}) {
  return {
    id: stop.id,
    code: stop.code,
    name: stop.name,
    latitude: stop.latitude.toNumber(),
    longitude: stop.longitude.toNumber(),
  };
}

function routeDto(route: Awaited<ReturnType<typeof createRouteRecord>>) {
  return {
    id: route.id,
    name: route.name,
    stops: route.routeStops.map((routeStop) => routeStop.stop.name),
    routeStops: route.routeStops.map((routeStop) => ({
      id: routeStop.id,
      position: routeStop.position,
      travelDurationToNextMinutes:
        routeStop.travelDurationToNextMinutes,
      stop: stopDto(routeStop.stop),
    })),
    tripsCount: route._count.trips,
  };
}

function busDto(bus: Awaited<ReturnType<typeof createBusRecord>>) {
  return {
    id: bus.id,
    plateNumber: bus.plateNumber,
    seatedCapacity: bus.seatedCapacity,
    standingCapacity: bus.standingCapacity,
    status: bus.status,
    assignedDriverId: bus.assignedDriverId,
    tripsCount: bus._count.trips,
    _count: bus._count,
  };
}

function fleetFailure(error: unknown): never {
  if (error instanceof FleetPersistenceError) {
    if (error.code === "NOT_FOUND") throw notFound("Fleet asset not found");
    if (error.code === "DUPLICATE") throw conflict("Fleet asset already exists");
    if (error.code === "STOP_IN_ACTIVE_ROUTE") {
      throw conflict("Deactivate or edit active Routes that use this Stop first");
    }
    throw conflict("A retired Bus cannot be reactivated");
  }
  if (
    error instanceof Error &&
    (error.message.includes("Unique constraint") || error.message.includes("P2002"))
  ) {
    throw conflict("A fleet asset with that unique value already exists");
  }
  throw error;
}

export async function listBuses(actor: FleetActor) {
  requireAdmin(actor);
  return (await listBusesRecord()).map(busDto);
}

export async function createBus(actor: FleetActor, input: CreateBusInput) {
  requireAdmin(actor);
  try {
    return busDto(await createBusRecord(input));
  } catch (error) {
    fleetFailure(error);
  }
}

export async function updateBus(
  actor: FleetActor,
  input: UpdateBusInput,
  clock: Clock = systemClock,
) {
  requireAdmin(actor);
  try {
    return busDto(await updateBusRecord(actor.userId, input, clock.now()));
  } catch (error) {
    fleetFailure(error);
  }
}

export async function retireBus(
  actor: FleetActor,
  id: string,
  clock: Clock = systemClock,
) {
  requireAdmin(actor);
  try {
    return busDto(await retireBusRecord(actor.userId, id, clock.now()));
  } catch (error) {
    fleetFailure(error);
  }
}

export async function listStops(actor: FleetActor) {
  requireAdmin(actor);
  return (await listActiveStopsRecord()).map(stopDto);
}

export async function createStop(actor: FleetActor, input: CreateStopInput) {
  requireAdmin(actor);
  try {
    return stopDto(await createStopRecord(input));
  } catch (error) {
    fleetFailure(error);
  }
}

export async function updateStop(actor: FleetActor, input: UpdateStopInput) {
  requireAdmin(actor);
  try {
    return stopDto(await updateStopRecord(input));
  } catch (error) {
    fleetFailure(error);
  }
}

export async function retireStop(actor: FleetActor, id: string) {
  requireAdmin(actor);
  try {
    return await retireStopRecord(id);
  } catch (error) {
    fleetFailure(error);
  }
}

export async function listRoutes(actor: FleetActor) {
  requireAdmin(actor);
  return (await listActiveRoutesRecord()).map(routeDto);
}

export async function listPublicRoutes() {
  return (await listActiveRoutesRecord()).map(routeDto);
}

export async function createRoute(actor: FleetActor, input: CreateRouteInput) {
  requireAdmin(actor);
  try {
    return routeDto(await createRouteRecord(input));
  } catch (error) {
    topologyFailure(error);
  }
}

export async function updateRoute(actor: FleetActor, input: UpdateRouteInput) {
  requireAdmin(actor);
  try {
    return routeDto(await updateRouteRecord(input));
  } catch (error) {
    topologyFailure(error);
  }
}

export async function retireRoute(actor: FleetActor, id: string) {
  requireAdmin(actor);
  return retireRouteRecord(id);
}
