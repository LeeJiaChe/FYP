// Seed values are public fixture data and cannot authenticate a shared account.
export function isKnownFixturePassword(password: string): boolean {
  return password === "password123" || password === "admin1";
}
