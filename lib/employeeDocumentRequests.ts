import { z } from "zod";

export const EMPLOYEE_DOCUMENT_REQUEST_TYPES = [
  "salary_certificate",
  "salary_transfer_letter",
  "noc",
  "employment_certificate",
  "experience_letter",
  "other",
] as const;

export type EmployeeDocumentRequestType = (typeof EMPLOYEE_DOCUMENT_REQUEST_TYPES)[number];
export type EmployeeDocumentRequestStatus = "requested" | "in_progress" | "ready";

export const EMPLOYEE_DOCUMENT_REQUEST_LABELS: Record<EmployeeDocumentRequestType, string> = {
  salary_certificate: "Salary Certificate",
  salary_transfer_letter: "Salary Transfer Letter",
  noc: "NOC",
  employment_certificate: "Employment Certificate / Confirmation Letter",
  experience_letter: "Experience Letter",
  other: "Other",
};

const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RequestInputSchema = z.object({
  requestType: z.enum(EMPLOYEE_DOCUMENT_REQUEST_TYPES),
  details: z.string().trim().max(1000).optional(),
  neededBy: DateOnlySchema.optional(),
}).superRefine((value, context) => {
  if (value.requestType === "other" && (value.details?.length ?? 0) < 3) {
    context.addIssue({
      code: "custom",
      path: ["details"],
      message: "Describe the document you need",
    });
  }
});

export type EmployeeDocumentRequestInput = {
  requestType: EmployeeDocumentRequestType;
  details?: string;
  neededBy?: string;
};

export function parseEmployeeDocumentRequestInput(
  input: unknown,
  today = new Date(),
): EmployeeDocumentRequestInput {
  const parsed = RequestInputSchema.parse(input);
  const todayIso = today.toISOString().slice(0, 10);
  if (parsed.neededBy && parsed.neededBy < todayIso) {
    throw new Error("EMPLOYEE_DOCUMENT_REQUEST_NEEDED_BY_PAST");
  }
  return {
    requestType: parsed.requestType,
    details: parsed.details || undefined,
    neededBy: parsed.neededBy,
  };
}

export function employeeDocumentRequestLabel(type: EmployeeDocumentRequestType): string {
  return EMPLOYEE_DOCUMENT_REQUEST_LABELS[type];
}

export function employeeDocumentType(type: EmployeeDocumentRequestType): string {
  return `hr_issued_${type}`;
}
