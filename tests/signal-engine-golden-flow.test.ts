import { describe, expect, it } from "vitest";

import type {
  ActionInsertDraft,
  EmployeeActionStateRow,
  EmployeeDocumentStateRow,
  EmployeeOffboardingStateRow,
  RiskSignalRow,
  SignalInsertDraft,
  SignalKind,
  SignalRepository,
} from "@/services/signalEngine/contracts";
import { emitOffboardingSignal } from "@/services/signalEngine/signalActions";
import { evaluateEmployeeDocumentExposure, isDashboardVisible } from "@/services/signalEngine/signalDomain";

class InMemorySignalRepository implements SignalRepository {
  public signals: RiskSignalRow[] = [];
  public actions: EmployeeActionStateRow[] = [];
  private sequence = 1;

  async findOpenSignalId(input: { tenantId: string; employeeId: string; kind: SignalKind }): Promise<string | null> {
    const row = this.signals.find(
      (signal) =>
        signal.tenant_id === input.tenantId &&
        signal.subject_employee_id === input.employeeId &&
        signal.kind === input.kind &&
        signal.resolved_at === null,
    );
    return row?.id ?? null;
  }

  async hasOpenActionForSignal(input: { tenantId: string; signalId: string }): Promise<boolean> {
    return this.actions.some(
      (action) =>
        action.tenant_id === input.tenantId &&
        action.risk_signal_id === input.signalId &&
        (action.status === "open" || action.status === "in_progress"),
    );
  }

  async createSignal(draft: SignalInsertDraft): Promise<string> {
    const id = `sig-${this.sequence++}`;
    this.signals.push({
      id,
      tenant_id: draft.tenant_id,
      kind: draft.kind,
      severity: draft.severity,
      subject_employee_id: draft.subject_employee_id,
      resolved_at: null,
      last_seen_at: draft.last_seen_at,
    });
    return id;
  }

  async createAction(draft: ActionInsertDraft): Promise<void> {
    this.actions.push({
      id: `act-${this.sequence++}`,
      tenant_id: draft.tenant_id,
      risk_signal_id: draft.risk_signal_id,
      subject_employee_id: draft.subject_employee_id,
      category: draft.category,
      status: draft.status,
    });
  }
}

describe("signal engine golden flow", () => {
  it("covers offboarding lifecycle, document evaluation, signal emit, action create, and dashboard visibility", async () => {
    const now = new Date("2026-01-10T00:00:00.000Z");

    const employee: EmployeeOffboardingStateRow = {
      id: "EMP_1",
      tenant_id: "TENANT_A",
      lifecycle_state: "offboarding",
      status: "active",
    };

    const documents: EmployeeDocumentStateRow[] = [
      {
        id: "DOC_1",
        tenant_id: "TENANT_A",
        employee_id: "EMP_1",
        document_type: "passport",
        signed_at: "2025-01-10T00:00:00.000Z",
        expires_at: "2026-01-30T00:00:00.000Z",
      },
    ];

    const exposure = evaluateEmployeeDocumentExposure({
      employee,
      documents,
      now,
    });

    expect(exposure.hasMissingContract).toBe(true);
    expect(exposure.hasExpiringDocument).toBe(true);

    const repository = new InMemorySignalRepository();
    const signalId = await emitOffboardingSignal({
      repository,
      request: {
        tenant_id: "TENANT_A",
        employee_id: "EMP_1",
        kind: "incomplete_offboarding",
        status: "open",
      },
      now,
    });

    expect(signalId).toBe("sig-1");
    expect(repository.signals).toHaveLength(1);
    expect(repository.actions).toHaveLength(1);

    const action = repository.actions[0];
    const visible = isDashboardVisible({
      lifecycle_state: employee.lifecycle_state,
      signalKind: "incomplete_offboarding",
      actionStatus: action.status,
      hasMissingContract: exposure.hasMissingContract,
      hasExpiringDocument: exposure.hasExpiringDocument,
    });

    expect(visible).toBe(true);
  });
});
