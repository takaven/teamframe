import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withQuery } from "@/lib/ui/returnPath";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("fragment-aware return paths", () => {
  it.each([
    ["/people", "status", "saved", "/people?status=saved"],
    ["/documents?view=requests", "error", "FORBIDDEN", "/documents?view=requests&error=FORBIDDEN"],
    ["/documents-and-policies#documents", "status", "uploaded", "/documents-and-policies?status=uploaded#documents"],
    ["/documents-and-policies?mode=self#policies", "error", "NOT FOUND", "/documents-and-policies?mode=self&error=NOT%20FOUND#policies"],
  ] as const)("preserves query and fragment ordering for %s", (path, key, value, expected) => {
    expect(withQuery(path, key, value)).toBe(expected);
  });

  it("uses the helper on the confirmed fragment-bearing action paths", () => {
    const employees = read("app/employees/actions.ts");
    const policies = read("app/policies/actions.ts");
    const documentRequests = read("app/document-requests/actions.ts");

    expect(employees).toContain('redirect(withQuery(returnTo, "status", "document_uploaded"))');
    expect(policies).toContain('redirect(withQuery(returnTo, "status", "policy_acknowledged"))');
    expect(policies).toContain('redirect(withQuery(returnTo, "error", errorCode))');
    expect(documentRequests).toContain('redirect(withQuery(returnTo, "status", "document_request_created"))');
  });
});
