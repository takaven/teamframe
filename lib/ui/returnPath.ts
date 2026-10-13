export function withQuery(path: string, key: "status" | "error", value: string): string {
  const [rawBase, hash] = path.split("#", 2);
  const base = rawBase || "/";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}
