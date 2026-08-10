import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPositionTree,
  validatePositionJdFileForTest,
  validateSingleAssignmentInvariant,
  wouldCreateReportingCycle,
  type PositionRecord,
} from "@/services/positionService/model";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function position(input: Partial<PositionRecord> & Pick<PositionRecord, "id" | "title">): PositionRecord {
  return {
    department: "Operations",
    parent_position_id: null,
    assigned_employee_id: null,
    assigned_employee_name: null,
    note: null,
    status: "Vacant",
    jd_attached: false,
    jd_original_filename: null,
    jd_mime_type: null,
    jd_uploaded_at: null,
    created_at: "2026-08-07T00:00:00.000Z",
    updated_at: "2026-08-07T00:00:00.000Z",
    ...input,
  };
}

describe("Org Chart position model", () => {
  it("builds a position-first reporting tree with filled and vacant nodes", () => {
    const tree = buildPositionTree([
      position({ id: "ops", title: "Head of Operations", parent_position_id: "md", status: "Filled", assigned_employee_id: "emp-1", assigned_employee_name: "Amina Rahman" }),
      position({ id: "md", title: "Managing Director", status: "Filled", assigned_employee_id: "emp-0", assigned_employee_name: "Isla Morgan" }),
      position({ id: "coordinator", title: "Operations Coordinator", parent_position_id: "ops" }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.title).toBe("Managing Director");
    expect(tree[0]?.children[0]?.title).toBe("Head of Operations");
    expect(tree[0]?.children[0]?.children[0]?.status).toBe("Vacant");
  });

  it("rejects self-reporting and circular reporting relationships", () => {
    const positions = [
      { id: "a", parent_position_id: null },
      { id: "b", parent_position_id: "a" },
      { id: "c", parent_position_id: "b" },
    ];

    expect(wouldCreateReportingCycle(positions, "a", "a")).toBe(true);
    expect(wouldCreateReportingCycle(positions, "a", "c")).toBe(true);
    expect(wouldCreateReportingCycle(positions, "c", "a")).toBe(false);
  });

  it("allows each active employee to occupy at most one active position", () => {
    expect(
      validateSingleAssignmentInvariant([
        { id: "a", assigned_employee_id: "emp-1" },
        { id: "b", assigned_employee_id: null },
        { id: "c", assigned_employee_id: "emp-2" },
      ]),
    ).toBe(true);

    expect(
      validateSingleAssignmentInvariant([
        { id: "a", assigned_employee_id: "emp-1" },
        { id: "b", assigned_employee_id: "emp-1" },
      ]),
    ).toBe(false);
  });
});

describe("Org Chart job-description attachment validation", () => {
  it("accepts PDF and DOCX job descriptions", () => {
    expect(
      validatePositionJdFileForTest({
        fileName: "head-of-operations.pdf",
        mimeType: "application/pdf",
        size: 10,
        bytes: Buffer.from("%PDF-1.7\n", "ascii"),
      }),
    ).toBe("pdf");

    expect(
      validatePositionJdFileForTest({
        fileName: "finance-manager.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 64,
        bytes: Buffer.concat([
          Buffer.from("PK\u0003\u0004", "ascii"),
          Buffer.from("[Content_Types].xml word/document.xml", "ascii"),
        ]),
      }),
    ).toBe("docx");
  });

  it("rejects unsupported, oversized and spoofed job descriptions", () => {
    expect(() =>
      validatePositionJdFileForTest({
        fileName: "jd.txt",
        mimeType: "text/plain",
        size: 10,
        bytes: Buffer.from("hello", "ascii"),
      }),
    ).toThrow("POSITION_JD_UNSUPPORTED_EXTENSION");

    expect(() =>
      validatePositionJdFileForTest({
        fileName: "jd.pdf",
        mimeType: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
        bytes: Buffer.from("%PDF", "ascii"),
      }),
    ).toThrow("POSITION_JD_TOO_LARGE");

    expect(() =>
      validatePositionJdFileForTest({
        fileName: "jd.pdf",
        mimeType: "application/pdf",
        size: 10,
        bytes: Buffer.from("not a pdf", "ascii"),
      }),
    ).toThrow("POSITION_JD_SIGNATURE_MISMATCH");
  });
});

describe("Org Chart schema and UI contracts", () => {
  it("adds tenant-scoped position constraints and lifecycle operations", () => {
    const positionsSchema = read("schemas/positions.sql");
    const rlsSchema = read("schemas/tenancy_rls.sql");
    const lifecycleSchema = read("schemas/file_lifecycle.sql");
    const mutationSchema = read("schemas/transactional_mutations.sql");

    expect(positionsSchema).toContain("create table if not exists positions");
    expect(positionsSchema).toContain("positions_tenant_parent_fk");
    expect(positionsSchema).toContain("positions_tenant_employee_fk");
    expect(positionsSchema).toContain("positions_one_active_assignment_per_employee_idx");
    expect(positionsSchema).toContain("POSITION_REPORTING_CYCLE");
    expect(rlsSchema).toContain("positions_select_admin");
    expect(lifecycleSchema).toContain("position_jd_upload");
    expect(lifecycleSchema).toContain("position_jd_delete");
    expect(mutationSchema).toContain("position.employee_assigned");
    expect(mutationSchema).toContain("position.vacated");
  });

  it("exposes one Org Chart admin route and navigation item", () => {
    const appShell = read("components/AppShell.tsx");
    const page = read("app/org-chart/page.tsx");

    expect(appShell).toContain('{ href: "/org-chart", label: "Org chart" }');
    expect(page).toContain("Design your team structure.");
    expect(page).toContain("JD attached");
    expect(page).toContain("Open employee");
  });
});
