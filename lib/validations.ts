import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["STUDENT", "DRIVER", "ADMIN"]).default("STUDENT"),
  studentId: z.string().optional(),
});

export const loginSchema = z.object({
  emailOrStudentId: z.string().min(1, "Email or Student ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const createBusSchema = z.object({
  plateNumber: z.string().min(2, "Plate number required"),
  capacity: z.number().int().positive("Capacity must be positive"),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED"]).default("ACTIVE"),
});

export const createRouteSchema = z.object({
  name: z.string().min(2, "Route name required"),
  stops: z.array(z.string()).min(2, "At least two stops required"),
});

const parseableDatetime = z
  .string()
  .refine((v) => !isNaN(new Date(v).getTime()), { message: "Invalid date/time value" });

export const createTripSchema = z.object({
  routeId: z.string().uuid("Route selection is required"),
  busId: z.string().uuid("Bus selection is required"),
  driverId: z.string().uuid("Invalid driver ID").optional().nullable().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  departureTime: parseableDatetime,
  estimatedArrivalTime: parseableDatetime,
});

export const updateTripStatusSchema = z.object({
  status: z.enum(["NOT_STARTED", "BOARDING", "DEPARTED", "ARRIVED", "DELAYED", "CANCELLED"]),
  delayReason: z.string().optional(),
});

export const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  seatId: z.string().uuid().optional(),
});

export const submitAppealSchema = z.object({
  reason: z.string().min(10, "Please provide a detailed explanation (at least 10 characters)"),
});

export const reviewAppealSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminComment: z.string().optional(),
});
