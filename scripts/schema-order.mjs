/**
 * Single source of truth for TeamFrame schema apply order.
 */

export const SCHEMA_ORDER = [
  "companies.sql",
  "employees.sql",
  "employee_profiles.sql",
  "compensation.sql",
  "positions.sql",
  "documents.sql",
  "leaves.sql",
  "audit_logs.sql",
  "hr_automation.sql",
  "risk_signals.sql",
  "action_items.sql",
  "analytics_events.sql",
  "onboarding_tasks.sql",
  "policies.sql",
  "procedures.sql",
  "acknowledgements.sql",
  "tenant_integrity.sql",
  "document_requirements.sql",
  "employment_changes.sql",
  "early_employment.sql",
  "file_lifecycle.sql",
  "tenancy_rls.sql",
  "tenancy_rls_v2.sql",
  // Phase 1 config foundations. Applied after the tenancy helper functions
  // (current_actor_tenant_id / is_current_actor_admin) so their RLS policies resolve.
  // Each file only FKs to companies, which is applied first.
  "departments.sql",
  "work_locations.sql",
  "leave_definitions.sql",
  // The leave RPC declares a leave_definitions row, so this table must exist
  // before transactional_mutations.sql is parsed on a fresh database.
  "transactional_mutations.sql",
  "access_model.sql",
  "offboarding.sql",
  // Phase 2: position occupancy history + positions→config FKs. Applies last so it
  // can reference departments, work_locations, positions and employees.
  "position_assignments.sql",
  // Phase 8 consolidated founder-correction pass: company logo + compensation mode,
  // department data-integrity (adopt labels + employees.department_id), and configurable
  // compensation (components/amounts/history). Applies last — references every table above
  // and the access-model capability helpers.
  "phase8_corrections.sql",
  // Explicit service-layer API privileges follow the last table-creating file.
  "api_privileges.sql",
  // One-way HirePass provenance depends on the ordinary employee RPC and grants.
  "hire_people_handoff.sql",
];
