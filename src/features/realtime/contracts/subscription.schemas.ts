import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const realtimeSubscriptionSchema = z.object({ tripId: uuidSchema });

