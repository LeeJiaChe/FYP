import { googleStudentConfiguration } from "@/features/identity/server";

export function GET() {
  return Response.json(googleStudentConfiguration());
}
