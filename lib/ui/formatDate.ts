// One humane date format across TeamFrame: "20 Sep 2026". Forces 3-letter months (ICU en-GB
// otherwise renders September as "Sept", breaking consistency). Accepts a YYYY-MM-DD string or a
// full ISO timestamp; treats date-only values as UTC calendar dates.
const MONTHS_3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function humaneDate(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.length === 10 ? `${value}T00:00:00Z` : value;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS_3[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
