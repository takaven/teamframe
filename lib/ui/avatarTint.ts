// Deterministic muted avatar tints (no JSX so tests can import it cleanly). Same person → same
// colour everywhere. Restrained professional palette, never neon.
export const AVATAR_TINTS = [
  "bg-[#eef1f4] text-[#4a5462]",
  "bg-[#eef2ee] text-[#4a5a4e]",
  "bg-[#f1eef2] text-[#57505e]",
  "bg-[#eef1f3] text-[#495663]",
  "bg-[#f2f0ec] text-[#5c554a]",
];

export function avatarTint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length] ?? AVATAR_TINTS[0]!;
}
