import { getUserFromToken } from "@/lib/auth";
import {
  createServiceLine,
  createServiceLineSchema,
  listServiceLines,
  updateServiceLine,
  updateServiceLineSchema,
} from "@/features/fleet/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { lines: await listServiceLines(await actor()) },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      line: await createServiceLine(
        await actor(),
        await parseJsonBody(request, createServiceLineSchema),
      ),
    },
    status: 201,
  }));
}

export async function PATCH(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      line: await updateServiceLine(
        await actor(),
        await parseJsonBody(request, updateServiceLineSchema),
      ),
    },
  }));
}
