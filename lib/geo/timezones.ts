export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.trim() }).format();
    return true;
  } catch {
    return false;
  }
}
