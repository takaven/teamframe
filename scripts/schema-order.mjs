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
  "transactional_mutations.sql",
  "file_lifecycle.sql",
  "tenancy_rls.sql",
  "tenancy_rls_v2.sql",
  "access_model.sql",
  "offboarding.sql",
  // Phase 1 config foundations. Applied after the tenancy helper functions
  // (current_actor_tenant_id / is_current_actor_admin) so their RLS policies resolve.
  // Each file only FKs to companies, which is applied first.
  "departments.sql",
  "work_locations.sql",
  "leave_definitions.sql",
  // Phase 2: position occupancy history + positions→config FKs. Applies last so it
  // can reference departments, work_locations, positions and employees.
  "position_assignments.sql",
];
