import {
  simulateLocationSchema,
  simulateTrustedLocation,
} from "@/features/location/server";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(
    request,
    async () => {
      const input = await parseJsonBody(request, simulateLocationSchema, 1_024);
      return {
        body: {
          sample: await simulateTrustedLocation(
            request.headers.get("x-service-secret"),
            input.tripId,
          ),
        },
        status: 201,
      };
    },
    { originPolicy: "trusted-service" },
  );
}

