import "server-only";

export type MissingJurisdictionRequirementReconcileResult = {
  scannedEmployees: number;
  createdSignals: number;
  updatedSignals: number;
  resolvedSignals: number;
};

/**
 * The country-driven rule is retired. Active document requirements are the only
 * applicability source. Existing inferred signals are closed atomically by the
 * Phase A schema migration, so the runtime engine must never recreate them.
 */
export async function reconcileMissingJurisdictionRequirementSignals(_params: {
  tenantId: string;
  actorUserId?: string;
  now?: Date;
}): Promise<MissingJurisdictionRequirementReconcileResult> {
  return { scannedEmployees: 0, createdSignals: 0, updatedSignals: 0, resolvedSignals: 0 };
}
