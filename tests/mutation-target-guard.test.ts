import { describe, expect, it } from "vitest";
import { mutationTargetRef } from "../scripts/lib/mutation-target-guard.mjs";

const ref = "dcfxyjrfsrkibhpbmjnw";
const retiredRefs = [
  "wafkfvpsdhjfrxrmgksl",
  "euhvgedjldqzfczkzjqi",
  "syytforaidoorrvrbqwz",
];
const valid = {
  TEAMFRAME_MUTATION_PROJECT_REF: ref,
  TEAMFRAME_MUTATION_APPROVAL: `seed-admin:${ref}`,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key",
};

describe("mutation target guard", () => {
  it("accepts only the active direct-mutation target with exact approval", () => {
    expect(mutationTargetRef("seed-admin", valid)).toBe(ref);
    for (const existing of retiredRefs) {
      expect(() => mutationTargetRef("seed-admin", {
        ...valid,
        TEAMFRAME_MUTATION_PROJECT_REF: existing,
        TEAMFRAME_MUTATION_APPROVAL: `seed-admin:${existing}`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${existing}.supabase.co`,
      })).toThrow(/refused/);
    }
  });

  it("cannot re-admit a retired target through the eligible subset", () => {
    const retired = retiredRefs[0]!;
    expect(() => mutationTargetRef("seed-admin", {
      ...valid,
      TEAMFRAME_MUTATION_PROJECT_REF: retired,
      TEAMFRAME_MUTATION_APPROVAL: `seed-admin:${retired}`,
      NEXT_PUBLIC_SUPABASE_URL: `https://${retired}.supabase.co`,
    }, new Set([retired]))).toThrow(/refused/);
  });

  it.each([
    ["missing ref", { TEAMFRAME_MUTATION_PROJECT_REF: undefined }],
    ["unapproved ref", { TEAMFRAME_MUTATION_PROJECT_REF: "qrsxoumymbcehtltbtgn" }],
    ["wrong approval", { TEAMFRAME_MUTATION_APPROVAL: `seed-demo:${ref}` }],
    ["wrong URL", { NEXT_PUBLIC_SUPABASE_URL: "https://wafkfvpsdhjfrxrmgksl.supabase.co" }],
    ["URL suffix", { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co/` }],
    ["missing key", { SUPABASE_SERVICE_ROLE_KEY: undefined }],
  ])("refuses %s", (_label, override) => {
    expect(() => mutationTargetRef("seed-admin", { ...valid, ...override })).toThrow(/refused/);
  });
});
