import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scrubPII } from "@/lib/telemetry/scrub";

describe("magic-link diagnostic privacy", () => {
  it("redacts submitted identity and excludes raw provider messages", () => {
    const source = readFileSync(join(process.cwd(), "app/auth/actions.ts"), "utf8");
    const providerFailure = {
      email: "person@example.invalid",
      code: "provider_failure",
      status: 503,
      message: "raw provider response containing person@example.invalid",
    };

    expect(scrubPII(providerFailure)).toEqual({
      email: "[REDACTED]",
      code: "provider_failure",
      status: 503,
      message: providerFailure.message,
    });
    expect(source).toContain('scrubPII({');
    expect(source).toMatch(/AUTH_SEND_MAGIC_LINK_DIAGNOSTIC[\s\S]*email,[\s\S]*code,[\s\S]*status/);
    expect(source).not.toMatch(/AUTH_SEND_MAGIC_LINK_DIAGNOSTIC[\s\S]{0,180}message:\s*error\.message/);
  });
});
