import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";
import {
  createWalkInIntent,
  createWalkInIntentSchema,
  listMyWalkInIntents,
} from "@/features/walk-ins/server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { intents: await listMyWalkInIntents(await actor()) },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: await createWalkInIntent(
      await actor(),
      await parseJsonBody(request, createWalkInIntentSchema),
    ),
    status: 201,
  }));
}
