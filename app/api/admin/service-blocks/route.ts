import { getUserFromToken } from "@/lib/auth";
import {
  createServiceBlock,
  createServiceBlockSchema,
  listServiceBlocks,
} from "@/features/trips/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { serviceBlocks: await listServiceBlocks(await actor()) },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      serviceBlock: await createServiceBlock(
        await actor(),
        await parseJsonBody(request, createServiceBlockSchema),
      ),
    },
    status: 201,
  }));
}
