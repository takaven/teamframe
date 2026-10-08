-- Phase A existing-install migration: leave timing, explicit probation, and
-- retirement of country-derived document signals. This migration preserves
-- leave ledger/history, existing probation rows, and document evidence.

begin;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leave_definitions_single_entitlement_timing_check'
      and conrelid = 'leave_definitions'::regclass
  ) then
    alter table leave_definitions
      add constraint leave_definitions_single_entitlement_timing_check
      check (not (accrual_enabled and joining_date_pro_rata)) not valid;
  end if;
end $$;

create or replace function teamframe_leave_balance_components(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_leave_definition_id uuid,
  p_balance_year integer,
  p_as_of_date date default current_date,
  p_exclude_leave_id uuid default null
)
returns table (
  opening numeric,
  carried_forward numeric,
  accrued numeric,
  adjustments numeric,
  taken numeric,
  pending numeric,
  available numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def leave_definitions;
  v_employee employees;
  v_company companies;
  v_annual numeric := 0;
  v_year_start date := make_date(p_balance_year, 1, 1);
  v_year_end date := make_date(p_balance_year, 12, 31);
  v_eligible_start date;
  v_as_of date := least(greatest(p_as_of_date, make_date(p_balance_year, 1, 1)), make_date(p_balance_year, 12, 31));
  v_prorated numeric := 0;
  v_months numeric := 0;
  v_legacy_used numeric := 0;
begin
  if p_balance_year not between 2000 and 2200 then raise exception 'INVALID_INPUT'; end if;

  select * into v_def from leave_definitions
  where tenant_id = p_tenant_id and id = p_leave_definition_id and archived_at is null;
  select * into v_employee from employees
  where tenant_id = p_tenant_id and id = p_employee_id and deleted_at is null;
  if not found or v_def.id is null then raise exception 'LEAVE_BALANCE_SCOPE_INVALID'; end if;

  select * into v_company from companies where id = p_tenant_id;
  v_annual := coalesce(
    case when v_def.system_leave_type = 'annual' then v_employee.annual_leave_entitlement_override end,
    v_def.default_entitlement_days,
    case when v_def.system_leave_type = 'annual' then v_company.annual_leave_default_days::numeric end,
    0
  );

  v_eligible_start := greatest(v_year_start, coalesce(v_employee.start_date, v_year_start));
  if v_eligible_start > v_year_end then
    v_prorated := 0;
  elsif v_def.joining_date_pro_rata then
    v_prorated := round(v_annual * ((v_year_end - v_eligible_start + 1)::numeric / (v_year_end - v_year_start + 1)::numeric), 2);
  else
    v_prorated := v_annual;
  end if;

  if not v_def.accrual_enabled then
    accrued := v_prorated;
  elsif v_as_of < v_eligible_start then
    accrued := 0;
  elsif v_def.accrual_frequency = 'annual' then
    accrued := v_prorated;
  else
    v_months := ((extract(year from v_as_of)::integer - extract(year from v_eligible_start)::integer) * 12)
      + extract(month from v_as_of)::integer - extract(month from v_eligible_start)::integer + 1;
    accrued := least(v_prorated, round(v_annual * least(12, greatest(0, v_months)) / 12, 2));
  end if;

  select coalesce(sum(amount_days) filter (where entry_kind = 'opening'), 0),
         coalesce(sum(amount_days) filter (where entry_kind = 'carry_forward'), 0),
         coalesce(sum(amount_days) filter (where entry_kind = 'admin_adjustment'), 0)
  into opening, carried_forward, adjustments
  from leave_balance_entries
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and leave_definition_id = p_leave_definition_id and balance_year = p_balance_year
    and effective_date <= v_as_of;

  if v_def.system_leave_type = 'annual' then
    select coalesce(sum(used_days), 0) into v_legacy_used from leave_opening_adjustments
    where tenant_id = p_tenant_id and employee_id = p_employee_id
      and leave_type = 'annual' and period_year = p_balance_year;
  end if;

  select coalesce(sum(requested_days), 0) into taken from leaves
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and (leave_definition_id = p_leave_definition_id
      or (leave_definition_id is null and v_def.is_system and leave_type::text = v_def.system_leave_type))
    and status = 'approved' and extract(year from start_date)::integer = p_balance_year
    and (p_exclude_leave_id is null or id <> p_exclude_leave_id);
  taken := taken + v_legacy_used;

  select coalesce(sum(requested_days), 0) into pending from leaves
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and (leave_definition_id = p_leave_definition_id
      or (leave_definition_id is null and v_def.is_system and leave_type::text = v_def.system_leave_type))
    and status = 'pending' and extract(year from start_date)::integer = p_balance_year
    and (p_exclude_leave_id is null or id <> p_exclude_leave_id);

  opening := coalesce(opening, 0); carried_forward := coalesce(carried_forward, 0);
  adjustments := coalesce(adjustments, 0); taken := coalesce(taken, 0); pending := coalesce(pending, 0);
  available := opening + carried_forward + accrued + adjustments - taken - pending;
  return next;
end;
$$;

create or replace function teamframe_initialize_join_work(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees%rowtype;
  v_lifecycle employee_lifecycle_state;
  v_inserted_count integer := 0;
  v_base_date date;
  v_check_in_enabled boolean;
  v_check_in_id uuid;
  v_check_in_item_id uuid;
  v_manager_task_id uuid;
  v_manager_task_item_id uuid;
begin
  select * into v_employee from employees
  where tenant_id = p_tenant_id and id = p_employee_id and deleted_at is null
  for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;

  v_lifecycle := teamframe_derive_employee_lifecycle(
    v_employee.status, v_employee.setup_status, v_employee.start_date,
    v_employee.end_date, v_employee.lifecycle_state
  );
  if v_lifecycle in ('offboarding', 'exited') then
    return jsonb_build_object('initialized', false, 'reason', 'lifecycle_suppressed');
  end if;

  insert into employee_join_initializations (tenant_id, employee_id, initialized_by_user_id)
  values (p_tenant_id, p_employee_id, p_actor_user_id)
  on conflict (tenant_id, employee_id) do nothing;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    return jsonb_build_object('initialized', false, 'reason', 'already_initialized');
  end if;

  v_base_date := coalesce(v_employee.start_date, current_date);
  insert into onboarding_tasks (tenant_id, employee_id, title, status, assigned_by, due_date)
  values
    (p_tenant_id, p_employee_id, 'Sign your employment contract', 'pending', p_actor_user_id, v_base_date),
    (p_tenant_id, p_employee_id, 'Complete your employee profile', 'pending', p_actor_user_id, v_base_date),
    (p_tenant_id, p_employee_id, 'Upload ID and right-to-work documents', 'pending', p_actor_user_id, v_base_date + 2),
    (p_tenant_id, p_employee_id, 'Read and acknowledge company policies', 'pending', p_actor_user_id, v_base_date + 7),
    (p_tenant_id, p_employee_id, 'Confirm payroll and bank details', 'pending', p_actor_user_id, v_base_date + 7);

  if v_employee.manager_id is not null then
    insert into onboarding_tasks (
      tenant_id, employee_id, title, status, owner_role, owner_employee_id,
      assigned_by, due_date
    ) values (
      p_tenant_id, p_employee_id, 'Meet your manager', 'pending', 'manager',
      v_employee.manager_id, p_actor_user_id, v_base_date + 2
    ) returning id into v_manager_task_id;
    v_manager_task_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id, 'onboarding.manager_task_due',
      'onboarding.manager_task:' || v_manager_task_id::text,
      'onboarding_task', v_manager_task_id, v_employee.manager_id,
      ((v_base_date + 2)::text || 'T09:00:00Z')::timestamptz,
      'routine_reminder', null,
      jsonb_build_object('employee_id', p_employee_id, 'task_id', v_manager_task_id), 3
    );
    update onboarding_tasks set automation_item_id = v_manager_task_item_id
    where tenant_id = p_tenant_id and id = v_manager_task_id;
  end if;

  select coalesce(thirty_day_check_in_enabled, true) into v_check_in_enabled
  from companies where id = p_tenant_id;
  if coalesce(v_check_in_enabled, true) then
    insert into onboarding_check_ins (tenant_id, employee_id, due_date, questions)
    values (p_tenant_id, p_employee_id, v_base_date + 30, teamframe_onboarding_check_in_questions())
    on conflict (tenant_id, employee_id, due_date) do update set updated_at = clock_timestamp()
    returning id into v_check_in_id;
    v_check_in_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id, 'onboarding.check_in.due',
      'onboarding.check_in:' || p_employee_id::text || ':' || (v_base_date + 30)::text,
      'onboarding_check_in', v_check_in_id, p_employee_id,
      ((v_base_date + 30)::text || 'T09:00:00Z')::timestamptz,
      'routine_reminder', null,
      jsonb_build_object('employee_id', p_employee_id, 'milestone_days', 30), 3
    );
    update onboarding_check_ins set automation_item_id = v_check_in_item_id
    where tenant_id = p_tenant_id and id = v_check_in_id;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'early_employment.initialized', p_employee_id);
  return jsonb_build_object('initialized', true, 'onboarding_check_in_id', v_check_in_id, 'probation_review_id', null);
end;
$$;

create or replace function teamframe_schedule_probation_review(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_probation_end_date date
)
returns probation_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees%rowtype;
  v_review probation_reviews;
  v_review_item_id uuid;
  v_manager_item_id uuid;
  v_review_due_date date;
begin
  if p_probation_end_date is null then raise exception 'PROBATION_END_DATE_REQUIRED'; end if;
  select * into v_employee from employees
  where tenant_id = p_tenant_id and id = p_employee_id and deleted_at is null for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.start_date is null or p_probation_end_date <= v_employee.start_date then
    raise exception 'PROBATION_END_DATE_INVALID';
  end if;
  if v_employee.end_date is not null and p_probation_end_date > v_employee.end_date then
    raise exception 'PROBATION_END_AFTER_EMPLOYMENT_END';
  end if;

  v_review_due_date := greatest(v_employee.start_date, p_probation_end_date - 14);
  insert into probation_reviews (
    tenant_id, employee_id, probation_end_date, review_due_date, review_owner_user_id
  ) values (
    p_tenant_id, p_employee_id, p_probation_end_date, v_review_due_date, p_actor_user_id
  )
  on conflict (tenant_id, employee_id, probation_end_date)
  do update set updated_at = clock_timestamp()
  returning * into v_review;

  v_review_item_id := teamframe_ensure_hr_automation_item(
    p_tenant_id, 'probation.review_due',
    'probation.review:' || p_employee_id::text || ':' || p_probation_end_date::text,
    'probation_review', v_review.id, null,
    (v_review_due_date::text || 'T09:00:00Z')::timestamptz,
    'decision', null,
    jsonb_build_object('employee_id', p_employee_id, 'probation_end_date', p_probation_end_date), 3
  );
  update probation_reviews set automation_item_id = v_review_item_id
  where tenant_id = p_tenant_id and id = v_review.id;

  if v_employee.manager_id is not null then
    v_manager_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id, 'probation.manager_input_due',
      'probation.manager_input:' || v_review.id::text,
      'probation_review', v_review.id, v_employee.manager_id,
      (v_review_due_date::text || 'T09:00:00Z')::timestamptz,
      'routine_reminder', null,
      jsonb_build_object('employee_id', p_employee_id, 'probation_end_date', p_probation_end_date), 3
    );
    update probation_reviews set manager_input_automation_item_id = v_manager_item_id
    where tenant_id = p_tenant_id and id = v_review.id;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'probation.review_scheduled_from_terms', v_review.id);
  select * into v_review from probation_reviews where tenant_id = p_tenant_id and id = v_review.id;
  return v_review;
end;
$$;

create or replace function teamframe_create_employee(
  p_tenant_id uuid, p_actor_user_id uuid, p_full_name text, p_email text,
  p_role_title text, p_department text, p_timezone text,
  p_employment_type employment_type, p_country text, p_start_date date,
  p_end_date date, p_manager_id uuid, p_grade text, p_status employee_status,
  p_setup_status employee_setup_status, p_initialize_join_work boolean,
  p_probation_end_date date
)
returns employees
language plpgsql
security definer
set search_path = public
as $$
declare v_employee employees;
begin
  if p_initialize_join_work is null then raise exception 'JOIN_WORK_INTENT_REQUIRED'; end if;
  if not p_initialize_join_work and p_probation_end_date is not null then raise exception 'PROBATION_REQUIRES_JOIN_WORK'; end if;
  if p_probation_end_date is not null and (p_start_date is null or p_probation_end_date <= p_start_date) then raise exception 'PROBATION_END_DATE_INVALID'; end if;
  if p_probation_end_date is not null and p_end_date is not null and p_probation_end_date > p_end_date then raise exception 'PROBATION_END_AFTER_EMPLOYMENT_END'; end if;

  insert into employees (
    tenant_id, full_name, email, role_title, department, timezone,
    employment_type, country, start_date, end_date, manager_id, grade,
    status, lifecycle_state, setup_status
  ) values (
    p_tenant_id, p_full_name, p_email, p_role_title, p_department, p_timezone,
    p_employment_type, p_country, p_start_date, p_end_date, p_manager_id, p_grade,
    p_status, teamframe_derive_employee_lifecycle(p_status, p_setup_status, p_start_date, p_end_date, null),
    p_setup_status
  ) returning * into v_employee;
  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.created', v_employee.id);
  if p_initialize_join_work then
    perform teamframe_initialize_join_work(p_tenant_id, p_actor_user_id, v_employee.id);
    if p_probation_end_date is not null then
      perform teamframe_schedule_probation_review(p_tenant_id, p_actor_user_id, v_employee.id, p_probation_end_date);
    end if;
  end if;
  return v_employee;
end;
$$;

revoke all on function teamframe_leave_balance_components(uuid,uuid,uuid,integer,date,uuid) from public, anon, authenticated;
grant execute on function teamframe_leave_balance_components(uuid,uuid,uuid,integer,date,uuid) to service_role;
revoke all on function teamframe_initialize_join_work(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function teamframe_initialize_join_work(uuid,uuid,uuid) to service_role;
revoke all on function teamframe_schedule_probation_review(uuid,uuid,uuid,date) from public, anon, authenticated;
grant execute on function teamframe_schedule_probation_review(uuid,uuid,uuid,date) to service_role;
revoke all on function teamframe_create_employee(
  uuid,uuid,text,text,text,text,text,employment_type,text,date,date,uuid,text,employee_status,employee_setup_status,boolean,date
) from public, anon, authenticated;
grant execute on function teamframe_create_employee(
  uuid,uuid,text,text,text,text,text,employment_type,text,date,date,uuid,text,employee_status,employee_setup_status,boolean,date
) to service_role;

-- Retire open country-derived signals and their open actions with an auditable,
-- idempotent reason. Explicit document requirements remain unchanged.
update action_items a
set status = 'dismissed', resolved_at = coalesce(a.resolved_at, clock_timestamp())
from risk_signals r
where a.tenant_id = r.tenant_id and a.risk_signal_id = r.id
  and r.kind = 'missing_jurisdiction_requirement' and r.resolved_at is null
  and a.status in ('open', 'in_progress');

insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
select r.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid, 'system',
       'signal.missing_jurisdiction_requirement.rule_retired', r.id
from risk_signals r
where r.kind = 'missing_jurisdiction_requirement' and r.resolved_at is null
  and not exists (
    select 1 from audit_logs a
    where a.tenant_id = r.tenant_id and a.target_id = r.id
      and a.action_type = 'signal.missing_jurisdiction_requirement.rule_retired'
  );

update risk_signals
set resolved_at = clock_timestamp(), last_seen_at = clock_timestamp(),
    evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
      'resolution_reason', 'RULE RETIRED — APPLICABILITY REQUIRES EXPLICIT CONFIRMATION',
      'rule_retired_at', clock_timestamp()
    )
where kind = 'missing_jurisdiction_requirement' and resolved_at is null;

commit;
