import type { SignalEmitRequest, SignalRepository } from "@/services/signalEngine/contracts";
import { createEmitOffboardingPlan } from "@/services/signalEngine/signalDomain";

export async function emitOffboardingSignal(params: {
  repository: SignalRepository;
  request: SignalEmitRequest;
  now?: Date;
}): Promise<string> {
  if (params.request.kind !== "incomplete_offboarding") {
    throw new Error("SIGNAL_EMIT_UNSUPPORTED_KIND");
  }

  const nowIso = (params.now ?? new Date()).toISOString();

  const existingSignalId = await params.repository.findOpenSignalId({
    tenantId: params.request.tenant_id,
    employeeId: params.request.employee_id,
    kind: params.request.kind,
  });

  const hasOpenAction = existingSignalId
    ? await params.repository.hasOpenActionForSignal({
        tenantId: params.request.tenant_id,
        signalId: existingSignalId,
      })
    : false;

  const plan = createEmitOffboardingPlan({
    request: params.request,
    existingSignalId,
    hasOpenAction,
    nowIso,
  });

  const signalId = plan.shouldCreateSignal
    ? await params.repository.createSignal(plan.signalDraft)
    : plan.existingSignalId;

  if (!signalId) {
    throw new Error("SIGNAL_EMIT_PLAN_INVALID: signal id missing");
  }

  if (plan.shouldCreateAction) {
    await params.repository.createAction({
      ...plan.actionDraft,
      risk_signal_id: signalId,
    });
  }

  return signalId;
}