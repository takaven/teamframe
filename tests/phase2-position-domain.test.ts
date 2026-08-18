import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

// Service modules are server-only; bypass the guard so pure helpers import under Node.
vi.mock("server-only", () => ({}));

import { suggestRoleTitle } from "@/services/positionAssignmentService";
import { resolveAvatar } from "@/services/employeeMasterService";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const positions = read("schemas/positions.sql");
const assignments = read("schemas/position_assignments.sql");
const schemaOrder = read("scripts/schema-order.mjs");

describe("Phase 2 — position schema is additive", () => {
  it("adds department_id / work_location_id / budgeted to positions additively", () => {
    expect(positions).toContain("add column if not exists department_id uuid");
    expect(positions).toContain("add column if not exists work_location_id uuid");
    expect(positions).toContain("add column if not exists budgeted boolean");
    expect(positions).not.toMatch(/\bdrop\s+column\b/i);
    // The free-text department column must remain untouched (backward compatibility).
    expect(positions).toContain("add column if not exists department text");
  });

  it("registers position_assignments.sql last, after the Phase-1 config files", () => {
    expect(schemaOrder).toContain('"position_assignments.sql"');
    expect(schemaOrder.indexOf('"position_assignments.sql"')).toBeGreaterThan(schemaOrder.indexOf('"leave_definitions.sql"'));
  });
});

describe("Phase 2 — position_assignments occupancy model", () => {
  it("creates the table with effective dates + snapshot flag and tenant-composite FKs", () => {
    expect(assignments).toMatch(/create table if not exists position_assignments/);
    expect(assignments).toContain("effective_start date");
    expect(assignments).toContain("effective_end date");
    expect(assignments).toContain("is_snapshot boolean not null default false");
    expect(assignments).toMatch(/foreign key \(tenant_id, position_id\) references positions\(tenant_id, id\)/);
    expect(assignments).toMatch(/foreign key \(tenant_id, employee_id\) references employees\(tenant_id, id\)/);
  });

  it("enforces one OPEN assignment per position and per employee", () => {
    expect(assignments).toMatch(/unique index if not exists position_assignments_one_open_per_position[\s\S]+where effective_end is null/);
    expect(assignments).toMatch(/unique index if not exists position_assignments_one_open_per_employee[\s\S]+where effective_end is null/);
  });

  it("adds the composite unique keys + positions FKs the references need", () => {
    expect(assignments).toContain("departments_tenant_id_id_key");
    expect(assignments).toContain("work_locations_tenant_id_id_key");
    expect(assignments).toContain("positions_tenant_department_fk");
    expect(assignments).toContain("positions_tenant_work_location_fk");
  });

  it("backfills current occupants WITHOUT inventing a historical start date", () => {
    // The snapshot insert selects (effective_start=null, effective_end=null, is_snapshot=true).
    expect(assignments).toMatch(/select p\.tenant_id, p\.id, p\.assigned_employee_id, null, null, true/);
    // The backfill must not stamp current_date/now() as a fabricated start.
    const backfill = assignments.slice(assignments.indexOf("Migration snapshot"), assignments.indexOf("Transactional assignment"));
    expect(backfill).not.toMatch(/current_date|now\(\)/i);
  });

  it("provides transactional assign/vacate functions and blocks direct writes via RLS", () => {
    expect(assignments).toContain("function teamframe_assign_position_occupant");
    expect(assignments).toContain("function teamframe_vacate_position");
    expect(assignments).toContain("alter table position_assignments enable row level security");
    expect(assignments).toMatch(/position_assignments_select_admin[\s\S]+is_current_actor_admin\(\)/);
    expect(assignments).toMatch(/position_assignments_insert_blocked[\s\S]+with check \(false\)/);
  });
});

describe("Phase 2 — role_title vs Position behaviour", () => {
  it("prefills from position title when the employee has no title", () => {
    expect(suggestRoleTitle("", "", "Senior Accountant")).toEqual({ value: "Senior Accountant", replacesCustomTitle: false });
  });

  it("updates a title that merely mirrored the previous position", () => {
    expect(suggestRoleTitle("Accountant", "Accountant", "Senior Accountant")).toEqual({ value: "Senior Accountant", replacesCustomTitle: false });
  });

  it("keeps a deliberately different (custom) title and flags the divergence", () => {
    const r = suggestRoleTitle("Senior Accountant – Client Reporting", "Accountant", "Senior Accountant");
    expect(r.value).toBe("Senior Accountant – Client Reporting");
    expect(r.replacesCustomTitle).toBe(true);
  });

  it("does not flag divergence when the custom title already equals the new position title", () => {
    expect(suggestRoleTitle("Senior Accountant", "Accountant", "Senior Accountant")).toEqual({ value: "Senior Accountant", replacesCustomTitle: false });
  });
});

describe("Phase 2 — avatar presentation", () => {
  it("returns photo_url when present and initials fallback", () => {
    expect(resolveAvatar({ full_name: "Maya Chen", photo_url: "https://x/y.png" })).toEqual({ photoUrl: "https://x/y.png", initials: "MC" });
    expect(resolveAvatar({ full_name: "Maya Chen" })).toEqual({ photoUrl: null, initials: "MC" });
    expect(resolveAvatar({ full_name: "Prince", photo_url: null })).toEqual({ photoUrl: null, initials: "P" });
  });
});
