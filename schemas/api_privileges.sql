-- The launch project disables automatic API grants for newly created tables.
-- TeamFrame's service layer uses the server-only service_role key for data
-- operations. Keep the table list explicit: no anonymous table grants or
-- future-table anonymous defaults, and no RLS or storage-policy changes.
--
-- Fresh Supabase projects grant table API privileges to anon by default.
-- Revoke that platform default explicitly before granting the server-only
-- role. Authenticated grants remain owned by their feature schemas and RLS.
revoke all privileges on all tables in schema public from anon;
alter default privileges in schema public revoke all privileges on tables from anon;

grant select, insert, update, delete on table
  public.acknowledgements,
  public.action_items,
  public.analytics_events,
  public.audit_logs,
  public.companies,
  public.company_holidays,
  public.compensation,
  public.compensation_component_amounts,
  public.compensation_components,
  public.compensation_history,
  public.custom_field_definitions,
  public.custom_field_values,
  public.departments,
  public.document_requirements,
  public.documents,
  public.employee_document_requests,
  public.employee_join_initializations,
  public.employee_payment_details,
  public.employee_profiles,
  public.employees,
  public.employment_changes,
  public.export_files,
  public.file_operations,
  public.hr_automation_events,
  public.hr_automation_items,
  public.leave_definitions,
  public.leave_balance_entries,
  public.performance_review_templates,
  public.performance_review_cycles,
  public.performance_reviews,
  public.leave_opening_adjustments,
  public.leaves,
  public.offboarding_cases,
  public.offboarding_items,
  public.onboarding_check_ins,
  public.onboarding_tasks,
  public.onboarding_checklist_templates,
  public.onboarding_checklist_template_items,
  public.onboarding_checklist_assignments,
  public.policies,
  public.position_assignments,
  public.positions,
  public.probation_reviews,
  public.procedures,
  public.risk_signals,
  public.setup_import_batches,
  public.tenant_access_invitations,
  public.tenant_memberships,
  public.work_locations
to service_role;
