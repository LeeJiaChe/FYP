import { handleRoute } from "@/shared/http/handle-route.server";

/**
 * Self-service account deletion is outside the approved FYP scope. Keeping an
 * explicit response avoids retaining a second booking cancellation/promotion
 * algorithm while the legacy settings UI is removed in Phase 9.
 */
export async function DELETE(request: Request) {
  return handleRoute(request, async () => ({
    status: 410,
    body: {
      error: {
        code: "OUT_OF_SCOPE",
        message: "Self-service account deletion is not available.",
      },
    },
  }));
}
