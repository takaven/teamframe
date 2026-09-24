import { APPROVED_LAUNCH_PROJECT_REFS } from "../approved-launch-projects.mjs";

// These legacy direct-entry writers have no independently verified safe target.
// The general launch allowlist includes populated and protected fixtures.
export const APPROVED_DIRECT_MUTATION_REFS = new Set([
  "dcfxyjrfsrkibhpbmjnw",
]);

// Run before loading any repository env file or constructing a service-role client.
export function mutationTargetRef(command, env = process.env, eligibleRefs = APPROVED_DIRECT_MUTATION_REFS) {
  const ref = env.TEAMFRAME_MUTATION_PROJECT_REF;
  if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) || !eligibleRefs.has(ref) ||
      env.TEAMFRAME_MUTATION_APPROVAL !== `${command}:${ref}` ||
      env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
      !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`${command} refused: process-only approved project ref, exact API URL, service key and ${command}:<ref> approval required`);
  }
  return ref;
}
