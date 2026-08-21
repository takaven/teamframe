// Small employee avatar: uploaded photo when present, else initials on a deterministic muted tint.
// Server-safe (plain <img>); used in the directory, org chart, employee record and self-service.
import { avatarTint as tintOf } from "@/lib/ui/avatarTint";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (a + b).toUpperCase() || "?";
}

export function EmployeeAvatar({
  name,
  photoUrl,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const dim = `${size}px`;
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt="" width={size} height={size} style={{ width: dim, height: dim }} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      style={{ width: dim, height: dim, fontSize: Math.round(size * 0.34) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tintOf(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
