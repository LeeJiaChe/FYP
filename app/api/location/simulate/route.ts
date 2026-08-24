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
      const sample = await simulateTrustedLocation(
        request.headers.get("x-service-secret"),
        input.tripId,
      );
      return {
        body: {
          outcome: sample ? "RECORDED" : "NO_OPERATIONAL_TRIP",
          sample,
        },
        status: sample ? 201 : 200,
      };
    },
    { originPolicy: "trusted-service" },
  );
}
