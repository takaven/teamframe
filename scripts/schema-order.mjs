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
];
