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
  residence_visa: "Residence visa",
  work_permit: "Labour card / work permit",
  iloe: "ILOE certificate",
  hr_issued_salary_certificate: "Salary Certificate",
  hr_issued_salary_transfer_letter: "Salary Transfer Letter",
  hr_issued_noc: "NOC",
  hr_issued_employment_certificate: "Employment Certificate",
  hr_issued_experience_letter: "Experience Letter",
  hr_issued_other: "HR-issued document",
};

export function documentLabel(value: string): string {
  const key = value.trim().toLowerCase();
  return DOCUMENT_LABELS[key] ?? key.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

type FileRequirement = {
  state: string;
  current_expires_at: string | null;
};

export type EmployeeFileSummary = {
  required: number;
  complete: number;
  missing: number;
  awaitingReview: number;
  expiringWithin90Days: number;
};

/** Factual record completeness only; this deliberately makes no compliance judgement. */
export function summarizeEmployeeFile(
  requirements: readonly FileRequirement[],
  now = new Date(),
): EmployeeFileSummary {
  const current = requirements.filter((item) => !["cancelled", "replaced"].includes(item.state));
  const today = now.toISOString().slice(0, 10);
  const in90Days = new Date(now);
  in90Days.setUTCDate(in90Days.getUTCDate() + 90);
  const horizon = in90Days.toISOString().slice(0, 10);

  return {
    required: current.length,
    complete: current.filter((item) => item.state === "accepted").length,
    missing: current.filter((item) => ["requested", "rejected", "expired"].includes(item.state)).length,
    awaitingReview: current.filter((item) => item.state === "received").length,
    expiringWithin90Days: current.filter((item) => {
      const expiry = item.current_expires_at?.slice(0, 10);
      return Boolean(expiry && expiry >= today && expiry <= horizon);
    }).length,
  };
}
