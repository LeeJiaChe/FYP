import { reconcileNoShows } from "@/features/penalties/server";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(
    request,
    async () => ({
      body: await reconcileNoShows(request.headers.get("x-cron-secret")),
    }),
    { originPolicy: "trusted-service" },
  );
}
