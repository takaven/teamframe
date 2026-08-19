/**
 * Country-specific employee-record vocabulary (Phase 5E).
 *
 * These are RECORD-KEEPING categories only — TeamFrame stores what document exists, its factual
 * metadata, evidence, and expiry. It never concludes legal/compliance status. UAE record types are
 * ordinary `document_type` values that flow through the existing documents/document_requirements
 * model; this module is just the bounded list + the work-country gate.
 */

export const UAE_COUNTRY = "AE";

// The seven approved UAE record types (factual document categories, not legal requirements).
export const UAE_RECORD_TYPES = [
  { value: "visa", label: "Visa" },
  { value: "emirates_id", label: "Emirates ID" },
  { value: "passport", label: "Passport" },
  { value: "medical_fitness", label: "Medical fitness" },
  { value: "iloe", label: "ILOE" },
  { value: "medical_insurance", label: "Medical insurance" },
  { value: "employment_contract", label: "Employment contract" },
] as const;

export const UAE_RECORD_TYPE_VALUES: readonly string[] = UAE_RECORD_TYPES.map((t) => t.value);

export function uaeRecordLabel(documentType: string): string {
  return UAE_RECORD_TYPES.find((t) => t.value === documentType.toLowerCase())?.label
    ?? documentType.replace(/_/g, " ");
}

export function isUaeRecordType(documentType: string | null | undefined): boolean {
  return documentType != null && UAE_RECORD_TYPE_VALUES.includes(documentType.toLowerCase());
}

/**
 * Normalise a free-text or ISO country value to an ISO alpha-2 code (uppercase), or null when it
 * cannot be resolved. Accepts the common UAE spellings. Used for the AE gate — NEVER applied to
 * nationality (work country only drives country-specific record options).
 */
export function normalizeIsoCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "ae" || t === "uae" || t === "united arab emirates") return UAE_COUNTRY;
  if (/^[a-z]{2}$/.test(t)) return t.toUpperCase();
  return null;
}
