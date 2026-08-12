#!/usr/bin/env node
/**
 * guard-instrumentation.mjs
 *
 * Asserts that Sentry runtime instrumentation wiring is intact.
 *
 * Checks:
 *   1. instrumentation.ts exists
 *   2. sentry.server.config.ts exists
 *   3. sentry.edge.config.ts exists
 *   4. instrumentation-client.ts exists
 *   5. app/global-error.tsx exists
 *   6. instrumentation.ts contains: import("./sentry.server.config")
 *   7. instrumentation.ts contains: import("./sentry.edge.config")
 *   8. instrumentation.ts exports Sentry.captureRequestError as onRequestError
 *   9. instrumentation-client.ts exports Sentry.captureRouterTransitionStart
 *
 * Parsing strategy:
 *   File-existence checks via fs.existsSync. Import assertions via anchored
 *   regex on the raw file text — matches the exact dynamic import() expressions
 *   emitted by Next.js instrumentation hooks.
 *
 * Usage:
 *   node scripts/guard-instrumentation.mjs   (from project root)
 *   npm run guard:instrumentation
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
let failed = false;

function fail(msg) {
  console.error(`[FAIL] guard-instrumentation: ${msg}`);
  failed = true;
}

// ── 1. Required file existence ─────────────────────────────────────────────

const REQUIRED_FILES = [
  "instrumentation.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  "instrumentation-client.ts",
  "app/global-error.tsx",
];

for (const file of REQUIRED_FILES) {
  if (!existsSync(resolve(ROOT, file))) {
    fail(`Required file not found: ${file}`);
  }
}

// ── 2. Import assertions in instrumentation.ts ────────────────────────────

const instrPath = resolve(ROOT, "instrumentation.ts");
if (existsSync(instrPath)) {
  const src = readFileSync(instrPath, "utf8");

  // Anchored regex: matches the exact dynamic import() expressions used by
  // Next.js 15 instrumentation hooks (single or double quotes).
  const SERVER_IMPORT_RE = /import\(["']\.\/sentry\.server\.config["']\)/;
  const EDGE_IMPORT_RE   = /import\(["']\.\/sentry\.edge\.config["']\)/;
  const REQUEST_ERROR_RE = /export\s+const\s+onRequestError\s*=\s*Sentry\.captureRequestError/;

  if (!SERVER_IMPORT_RE.test(src)) {
    fail(
      'instrumentation.ts is missing: import("./sentry.server.config")\n' +
      "  Sentry server-side init will not fire at runtime — captureActionError will be a silent no-op.",
    );
  }

  if (!EDGE_IMPORT_RE.test(src)) {
    fail(
      'instrumentation.ts is missing: import("./sentry.edge.config")\n' +
      "  Sentry edge-runtime init will not fire — middleware exception capture will be a silent no-op.",
    );
  }

  if (!REQUEST_ERROR_RE.test(src)) {
    fail(
      "instrumentation.ts is missing: export const onRequestError = Sentry.captureRequestError\n" +
      "  App Router nested server errors will not be wired to Sentry.",
    );
  }
}

const clientInstrPath = resolve(ROOT, "instrumentation-client.ts");
if (existsSync(clientInstrPath)) {
  const src = readFileSync(clientInstrPath, "utf8");
  const ROUTER_TRANSITION_RE =
    /export\s+const\s+onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/;

  if (!ROUTER_TRANSITION_RE.test(src)) {
    fail(
      "instrumentation-client.ts is missing: export const onRouterTransitionStart = Sentry.captureRouterTransitionStart\n" +
      "  Client navigation transitions will not be wired to Sentry.",
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log("[PASS] guard-instrumentation: all Sentry wiring checks passed");
console.log("  ✓ instrumentation.ts exists");
console.log("  ✓ sentry.server.config.ts exists");
console.log("  ✓ sentry.edge.config.ts exists");
console.log("  ✓ instrumentation-client.ts exists");
console.log("  ✓ app/global-error.tsx exists");
console.log('  ✓ instrumentation.ts imports "./sentry.server.config"');
console.log('  ✓ instrumentation.ts imports "./sentry.edge.config"');
console.log("  ✓ instrumentation.ts exports onRequestError");
console.log("  ✓ instrumentation-client.ts exports onRouterTransitionStart");
