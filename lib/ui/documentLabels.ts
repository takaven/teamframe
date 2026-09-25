const DOCUMENT_LABELS: Readonly<Record<string, string>> = {
  contract: "Employment contract",
  employment_contract: "Employment contract",
  passport: "Passport",
  right_to_work: "Right to work",
  medical_fitness: "Medical fitness certificate",
  medical_insurance: "Medical insurance",
  emirates_id: "Emirates ID",
  jd: "Job description",
  cv: "CV",
  photo: "Photo",
  visa: "Visa",
  iloe: "ILOE certificate",
};

export function documentLabel(value: string): string {
  const key = value.trim().toLowerCase();
  return DOCUMENT_LABELS[key] ?? key.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
