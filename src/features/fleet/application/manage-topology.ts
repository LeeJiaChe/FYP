import type {
  CreateRouteInput,
  CreateStopInput,
  UpdateRouteInput,
  UpdateStopInput,
} from "../contracts/fleet.schemas";
import { RouteTopologyError } from "../domain/route-topology";
import {
  createRouteRecord,
  createStopRecord,
  listActiveRoutesRecord,
  listActiveStopsRecord,
  retireRouteRecord,
  retireStopRecord,
  updateRouteRecord,
  updateStopRecord,
} from "../infrastructure/fleet.prisma.server";
import {
  forbidden,
  validationError,
} from "@/shared/application/application-error";

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

export async function listStops(actor: FleetActor) {
  requireAdmin(actor);
  return (await listActiveStopsRecord()).map(stopDto);
}

export async function createStop(actor: FleetActor, input: CreateStopInput) {
  requireAdmin(actor);
  return stopDto(await createStopRecord(input));
}

export async function updateStop(actor: FleetActor, input: UpdateStopInput) {
  requireAdmin(actor);
  return stopDto(await updateStopRecord(input));
}

export async function retireStop(actor: FleetActor, id: string) {
  requireAdmin(actor);
  return retireStopRecord(id);
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
