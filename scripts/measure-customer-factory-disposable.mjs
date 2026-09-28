// One-shot operator measurement. No credentials are read from repository files.
import { spawnSync } from "node:child_process";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

const ref = process.env.TEAMFRAME_FACTORY_PROJECT_REF;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const approval = process.env.TEAMFRAME_FACTORY_APPROVAL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.TEAMFRAME_FACTORY_DB_URL;
const expectedUrl = `https://${ref}.supabase.co`;
let databaseUrl;
try { databaseUrl = new URL(connectionString); } catch { /* fail closed below */ }
const directRef = databaseUrl?.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const poolerRef = databaseUrl?.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];

if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) || url !== expectedUrl || approval !== `measure:${ref}` || !key ||
    databaseUrl?.protocol !== "postgresql:" || databaseUrl.search || databaseUrl.hash ||
    (directRef ?? poolerRef) !== ref ||
    (directRef && databaseUrl.username !== "postgres") ||
    (poolerRef && !databaseUrl.hostname.endsWith(".pooler.supabase.com"))) {
  console.error("Factory measurement refused: approved disposable ref, exact project/DB URLs, service key, and matching measure:<ref> approval are required in process environment.");
  process.exit(1);
}

const started = performance.now();
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/customer-factory-disposable-measure.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, TEAMFRAME_FACTORY_INVOKED: "1" },
});
console.log(`Factory command elapsed: ${((performance.now() - started) / 1000).toFixed(1)}s (includes test startup).`);
process.exit(result.status ?? 1);
