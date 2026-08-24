export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  studentId?: string | null;
  creditScore?: number;
}
