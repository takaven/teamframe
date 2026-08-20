// Small employee avatar: uploaded photo when present, else initials on a neutral chip.
// Server-safe (plain <img>); used in the directory table and org chart.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (a + b).toUpperCase() || "?";
}

// Restrained, muted tints (deterministic per name) — quiet variation, never loud.
const TINTS = [
  "bg-[#eef1f4] text-[#4a5462]",
  "bg-[#eef2ee] text-[#4a5a4e]",
  "bg-[#f1eef2] text-[#57505e]",
  "bg-[#eef1f3] text-[#495663]",
  "bg-[#f2f0ec] text-[#5c554a]",
];
function tintOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length] ?? TINTS[0]!;
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
