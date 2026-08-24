import { z } from "zod";

export const uuidSchema = z.string().uuid("Expected a valid UUID");
