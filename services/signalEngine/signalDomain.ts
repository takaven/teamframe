import type {
  EmployeeDocumentStateRow,
  EmployeeOffboardingStateRow,
  EmitOffboardingPlan,
  SignalEmitRequest,
} from "@/services/signalEngine/contracts";

function isContractDocument(document: EmployeeDocumentStateRow): boolean {
  return (document.document_type ?? "").trim().toLowerCase() === "contract";
}

export function evaluateEmployeeDocumentExposure(input: {
  employee: EmployeeOffboardingStateRow;
  documents: EmployeeDocumentStateRow[];
  now: Date;
}): { hasMissingContract: boolean; hasExpiringDocument: boolean } {
  const employeeDocuments = input.documents.filter((document) => document.employee_id === input.employee.id);

  const hasSignedContract = employeeDocuments.some(
    (document) => isContractDocument(document) && Boolean(document.signed_at),
  );

  const nowMs = input.now.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const hasExpiringDocument = employeeDocuments.some((document) => {
    if (!document.expires_at) return false;
    const expiresMs = new Date(document.expires_at).getTime();
    if (!Number.isFinite(expiresMs)) return false;
    return expiresMs >= nowMs && expiresMs <= nowMs + thirtyDaysMs;
  });

  return {
    hasMissingContract: !hasSignedContract,
    hasExpiringDocument,
  };
}

export function createEmitOffboardingPlan(input: {
  request: SignalEmitRequest;
  existingSignalId: string | null;
  hasOpenAction: boolean;
  nowIso: string;
}): EmitOffboardingPlan {
  return {
    existingSignalId: input.existingSignalId,
    shouldCreateSignal: input.existingSignalId === null,
    shouldCreateAction: !input.hasOpenAction,
    signalDraft: {
      tenant_id: input.request.tenant_id,
      kind: input.request.kind,
      trigger_reason: input.request.kind,
      severity: "yellow",
      subject_employee_id: input.request.employee_id,
      evidence: {
        emitted_by: "start_offboarding_action",
        status: input.request.status,
      },
      first_seen_at: input.nowIso,
      last_seen_at: input.nowIso,
      resolved_at: null,
    },
    actionDraft: {
      tenant_id: input.request.tenant_id,
      subject_employee_id: input.request.employee_id,
      category: "offboarding",
      title: "Complete offboarding checklist",
      suggested_action: "Complete offboarding checklist",
      status: "open",
    },
  };
}

export function isDashboardVisible(input: {
  lifecycle_state: EmployeeOffboardingStateRow["lifecycle_state"];
  signalKind: SignalEmitRequest["kind"];
  actionStatus: "open" | "in_progress" | "done" | "dismissed";
  hasMissingContract: boolean;
  hasExpiringDocument: boolean;
}): boolean {
  if (input.lifecycle_state !== "offboarding" && input.lifecycle_state !== "exited") {
    return false;
  }
  if (input.signalKind !== "incomplete_offboarding") {
    return false;
  }
  if (input.actionStatus !== "open" && input.actionStatus !== "in_progress") {
    return false;
  }
  return input.hasMissingContract || input.hasExpiringDocument;
}