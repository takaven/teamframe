#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_ORDER } from "./schema-order.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const schemasDir = join(projectRoot, "schemas");
const outputDir = join(projectRoot, ".ci", "schema-state");
const outputPath = join(outputDir, "schema-state.json");

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

const files = SCHEMA_ORDER.map((name) => {
  const path = join(schemasDir, name);
  const content = readFileSync(path, "utf8");
  return {
    name,
    sha256: sha256(content),
    bytes: Buffer.byteLength(content, "utf8"),
  };
});

const aggregate = createHash("sha256");
for (const file of files) {
  aggregate.update(file.name);
  aggregate.update("\n");
  aggregate.update(file.sha256);
  aggregate.update("\n");
}

const payload = {
  generatedAt: new Date().toISOString(),
  schemaOrder: SCHEMA_ORDER,
  files,
  schemaStateSha256: aggregate.digest("hex"),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`schema-state: wrote ${outputPath}`);
console.log(`schema-state-sha256: ${payload.schemaStateSha256}`);
