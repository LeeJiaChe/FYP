import { getUserFromToken } from "@/lib/auth";
import {
  createRoute,
  createRouteSchema,
  listRoutes,
  retireRoute,
  updateRoute,
  updateRouteSchema,
} from "@/features/fleet/server";
import { unauthenticated } from "@/shared/application/application-error";
import {
  handleRoute,
  parseJsonBody,
} from "@/shared/http/handle-route.server";
import { uuidSchema } from "@/shared/types/uuid";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { routes: await listRoutes(await actor()) },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      route: await createRoute(
        await actor(),
        await parseJsonBody(request, createRouteSchema),
      ),
    },
    status: 201,
  }));
}

export async function PATCH(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      route: await updateRoute(
        await actor(),
        await parseJsonBody(request, updateRouteSchema),
      ),
    },
  }));
}

export async function DELETE(request: Request) {
  return handleRoute(request, async () => {
    const id = uuidSchema.parse(new URL(request.url).searchParams.get("id"));
    await retireRoute(await actor(), id);
    return { body: { success: true } };
  });
}
