import { APPROVED_LAUNCH_PROJECT_REFS } from "../approved-launch-projects.mjs";

// Run before loading any repository env file or constructing a service-role client.
export function mutationTargetRef(command, env = process.env) {
  const ref = env.TEAMFRAME_MUTATION_PROJECT_REF;
  if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) ||
      env.TEAMFRAME_MUTATION_APPROVAL !== `${command}:${ref}` ||
      env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
      !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`${command} refused: process-only approved project ref, exact API URL, service key and ${command}:<ref> approval required`);
  }
  return ref;
}
