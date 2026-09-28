export const APPROVED_DIRECT_MUTATION_REFS: Set<string>;
export function mutationTargetRef(command: string, env?: Record<string, string | undefined>, eligibleRefs?: Set<string>): string;
