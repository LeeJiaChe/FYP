import { getUserFromToken } from "@/lib/auth";
import {
  createDriver,
  createDriverSchema,
  listDrivers,
  updateDriver,
  updateDriverSchema,
} from "@/features/identity/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({ body: { drivers: await listDrivers(await actor()) } }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: { success: true, driver: await createDriver(await actor(), await parseJsonBody(request, createDriverSchema)) },
    status: 201,
  }));
}

export async function PATCH(request: Request) {
  return handleRoute(request, async () => ({
    body: { success: true, driver: await updateDriver(await actor(), await parseJsonBody(request, updateDriverSchema)) },
  }));
}
