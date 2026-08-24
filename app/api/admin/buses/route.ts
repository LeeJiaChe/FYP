import { getUserFromToken } from "@/lib/auth";
import {
  createBus,
  createBusSchema,
  listBuses,
  retireBus,
  updateBus,
  updateBusSchema,
} from "@/features/fleet/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";
import { uuidSchema } from "@/shared/types/uuid";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { buses: await listBuses(await actor()) },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      bus: await createBus(await actor(), await parseJsonBody(request, createBusSchema)),
    },
    status: 201,
  }));
}

export async function PATCH(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      bus: await updateBus(await actor(), await parseJsonBody(request, updateBusSchema)),
    },
  }));
}

export async function DELETE(request: Request) {
  return handleRoute(request, async () => {
    const id = uuidSchema.parse(new URL(request.url).searchParams.get("id"));
    await retireBus(await actor(), id);
    return { body: { success: true } };
  });
}
