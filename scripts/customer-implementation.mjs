import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

if (process.argv.includes("--help")) {
  console.log("Usage: npm run customer:implement -- (--preflight|--execute) --pack <pack.json> --tenant-id <uuid> --confirm-workspace <slug>");
  console.log("See docs/operations/customer-implementation-runbook.md for guarded process-only environment requirements.");
  process.exit(0);
}

function value(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function refuse(message) {
  console.error(`Customer implementation refused: ${message}`);
  process.exit(1);
}

const mode = process.argv.includes("--execute") ? "execute" : process.argv.includes("--preflight") ? "preflight" : null;
const packPath = value("--pack");
const tenantId = value("--tenant-id");
const workspaceSlug = value("--confirm-workspace");
const ref = process.env.TEAMFRAME_IMPLEMENTATION_PROJECT_REF;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbString = process.env.TEAMFRAME_IMPLEMENTATION_DB_URL;
const approval = process.env.TEAMFRAME_IMPLEMENTATION_APPROVAL;
const requiredApproval = `${mode}:${ref}:${tenantId}`;
let dbUrl;
try { dbUrl = new URL(dbString); } catch { /* fail closed below */ }
const directRef = dbUrl?.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const poolerRef = dbUrl?.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
const absolutePack = packPath ? resolve(packPath) : "";

if (!mode) refuse("choose exactly one of --preflight or --execute");
if (process.argv.includes("--preflight") && process.argv.includes("--execute")) refuse("choose only one mode");
if (!absolutePack || !existsSync(absolutePack)) refuse("an existing --pack JSON file is required");
if (!tenantId || !/^[0-9a-f-]{36}$/.test(tenantId)) refuse("an exact --tenant-id UUID is required");
if (!workspaceSlug || !/^[a-z0-9-]+$/.test(workspaceSlug)) refuse("an exact --confirm-workspace slug is required");
if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) || apiUrl !== `https://${ref}.supabase.co` || !serviceKey ||
    process.env.TEAMFRAME_IMPLEMENTATION_CONTEXT !== "synthetic-customer-rehearsal" || approval !== requiredApproval ||
    dbUrl?.protocol !== "postgresql:" || dbUrl.search || dbUrl.hash || (directRef ?? poolerRef) !== ref ||
    (directRef && dbUrl.username !== "postgres") || (poolerRef && !dbUrl.hostname.endsWith(".pooler.supabase.com"))) {
  refuse(`exact approved synthetic project/API/DB identity, context, service key and ${requiredApproval} approval are required`);
}

const started = performance.now();
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/customer-implementation-runtime.test.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TEAMFRAME_IMPLEMENTATION_INVOKED: "1",
    TEAMFRAME_IMPLEMENTATION_MODE: mode,
    TEAMFRAME_IMPLEMENTATION_PACK: absolutePack,
    TEAMFRAME_IMPLEMENTATION_TENANT_ID: tenantId,
    TEAMFRAME_IMPLEMENTATION_WORKSPACE_SLUG: workspaceSlug,
  },
});
console.log(`Customer implementation command elapsed: ${((performance.now() - started) / 1000).toFixed(1)}s.`);
process.exit(result.status ?? 1);
