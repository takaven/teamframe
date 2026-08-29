/**
 * Installation facts shown in Setup → Installation & support.
 *
 * Deliberately a pure function over an explicit input shape: it can only ever
 * report the fields named below, so no environment variable, key, token or
 * storage credential can reach the screen. Values that cannot be determined
 * reliably are omitted rather than guessed — there is no status engine here.
 */

export type InstallationFact = { label: string; value: string; hint?: string };

export type InstallationFactsInput = {
  /** Product version from package.json. */
  productVersion: string;
  /** Customer-facing installation name (company identity). */
  installationName: string;
  /** Tenant identifier — useful when raising a support request. */
  installationId: string | null;
  /** Configured public application URL, if set. */
  appUrl?: string | null;
  /** Short release identifier, when the host exposes one. */
  releaseRef?: string | null;
};

function shortRef(ref: string): string {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}

function safeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function buildInstallationFacts(input: InstallationFactsInput): InstallationFact[] {
  const facts: InstallationFact[] = [
    { label: "TeamFrame version", value: input.productVersion },
    { label: "Installation", value: input.installationName },
  ];

  if (input.installationId) {
    facts.push({
      label: "Installation ID",
      value: input.installationId,
      hint: "Quote this when raising a support request.",
    });
  }

  const origin = input.appUrl ? safeOrigin(input.appUrl) : null;
  if (origin) {
    facts.push({ label: "Application address", value: origin });
  }

  if (input.releaseRef && input.releaseRef.trim().length > 0) {
    facts.push({ label: "Release", value: shortRef(input.releaseRef.trim()) });
  }

  return facts;
}

/**
 * Fixed, truthful statements about who is responsible for what. These describe
 * the TeamFrame delivery model; they do not read or report live system state.
 */
export const INSTALLATION_RESPONSIBILITIES: readonly InstallationFact[] = [
  {
    label: "Infrastructure",
    value: "Your organisation's own accounts",
    hint: "TeamFrame runs on hosting and database accounts held in your name. Platform charges are paid directly to those providers.",
  },
  {
    label: "Backups",
    value: "Provided by your database platform",
    hint: "Automated backups and their retention are a setting on your own database plan. Confirm the retention period there before loading employee data.",
  },
  {
    label: "Your data",
    value: "Exportable at any time",
    hint: "Use Export TeamFrame data below to take a complete, portable copy of this installation.",
  },
  {
    label: "Support access",
    value: "Granted and revoked by you",
    hint: "TeamFrame support has no standing access. Access is granted by adding the support account to your hosting and database accounts, and ends the moment you remove it.",
  },
] as const;
