import { retainRecentLocations } from "@/features/location/server";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(
    request,
    async () => ({
      body: await retainRecentLocations(request.headers.get("x-service-secret")),
    }),
    { originPolicy: "trusted-service" },
  );
}

