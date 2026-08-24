import {
  ingestLocationSchema,
  ingestTrustedLocation,
} from "@/features/location/server";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(
    request,
    async () => ({
      body: {
        sample: await ingestTrustedLocation(
          request.headers.get("x-service-secret"),
          await parseJsonBody(request, ingestLocationSchema, 4_096),
        ),
      },
      status: 201,
    }),
    { originPolicy: "trusted-service" },
  );
}

