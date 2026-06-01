import "server-only";

import { emitOffboardingSignal } from "@/services/signalEngine/signalActions";
import type { SignalEmitRequest } from "@/services/signalEngine/contracts";
import { createSignalRepository } from "@/services/signalEngine/signalRepository";

import {
  reconcileMissingContractSignals,
  type MissingContractReconcileResult,
} from "@/services/signalEngine/missingContract";
import {
  reconcileExpiringDocumentSignals,
  type ExpiringDocumentReconcileResult,
} from "@/services/signalEngine/expiringDocument";
import {
  reconcileUnacknowledgedPolicySignals,
  type UnacknowledgedPolicyReconcileResult,
} from "@/services/signalEngine/unacknowledgedPolicy";
import {
  reconcileIncompleteOnboardingSignals,
  type IncompleteOnboardingReconcileResult,
} from "@/services/signalEngine/incompleteOnboarding";
import {
  reconcileIncompleteOffboardingSignals,
  type IncompleteOffboardingReconcileResult,
} from "@/services/signalEngine/incompleteOffboarding";
import {
  reconcileActiveAccessAfterExitSignals,
  type ActiveAccessAfterExitReconcileResult,
} from "@/services/signalEngine/activeAccessAfterExit";
import {
  reconcileUnreturnedAssetSignals,
  type UnreturnedAssetReconcileResult,
} from "@/services/signalEngine/unreturnedAsset";
import {
  reconcileMissingJurisdictionRequirementSignals,
  type MissingJurisdictionRequirementReconcileResult,
} from "@/services/signalEngine/missingJurisdictionRequirement";
import {
  reconcileLeaveConflictSignals,
  type LeaveConflictReconcileResult,
} from "@/services/signalEngine/leaveConflict";

export type SignalEngineRunResult = {
  missingContract: MissingContractReconcileResult;
  expiringDocument: ExpiringDocumentReconcileResult;
  unacknowledgedPolicy: UnacknowledgedPolicyReconcileResult;
  incompleteOnboarding: IncompleteOnboardingReconcileResult;
  incompleteOffboarding: IncompleteOffboardingReconcileResult;
  activeAccessAfterExit: ActiveAccessAfterExitReconcileResult;
  unreturnedAsset: UnreturnedAssetReconcileResult;
  missingJurisdictionRequirement: MissingJurisdictionRequirementReconcileResult;
  leaveConflict: LeaveConflictReconcileResult;
};

export const signalEngine = {
  emit: async (signal: SignalEmitRequest) => {
    return emitOffboardingSignal({
      repository: createSignalRepository(),
      request: signal,
    });
  },
};

export async function runSignalEngineForTenant(params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<SignalEngineRunResult> {
  const missingContract = await reconcileMissingContractSignals(params);
  const expiringDocument = await reconcileExpiringDocumentSignals(params);
  const unacknowledgedPolicy = await reconcileUnacknowledgedPolicySignals(params);
  const incompleteOnboarding = await reconcileIncompleteOnboardingSignals(params);
  const incompleteOffboarding = await reconcileIncompleteOffboardingSignals(params);
  const activeAccessAfterExit = await reconcileActiveAccessAfterExitSignals(params);
  const unreturnedAsset = await reconcileUnreturnedAssetSignals(params);
  const missingJurisdictionRequirement = await reconcileMissingJurisdictionRequirementSignals(params);
  const leaveConflict = await reconcileLeaveConflictSignals(params);
  return {
    missingContract,
    expiringDocument,
    unacknowledgedPolicy,
    incompleteOnboarding,
    incompleteOffboarding,
    activeAccessAfterExit,
    unreturnedAsset,
    missingJurisdictionRequirement,
    leaveConflict,
  };
}
