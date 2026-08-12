-- TeamFrame MR-4 — join and early-employment workflows.
--
-- This is a bounded layer for automatic onboarding initialization, a 30-day
-- check-in, and simple probation review tracking. It consumes MR-2 automation
-- primitives and does not introduce document-evidence completion or a workflow
-- builder.

do $$ begin
  create type onboarding_check_in_status as enum ('scheduled', 'submitted', 'cancelled', 'suppressed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type probation_review_status as enum ('scheduled', 'due', 'completed', 'cancelled', 'suppressed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type probation_review_outcome as enum ('confirmed', 'extended', 'employment_ending');
exception when duplicate_object then null; end $$;

create table if not exists employee_join_initializations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  initialized_at timestamptz not null default now(),
  initialized_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint employee_join_initializations_employee_fk
    foreign key (tenant_id, employee_id)
    references employees(tenant_id, id)
    on delete cascade
);

create unique index if not exists employee_join_initializations_employee_idx
  on employee_join_initializations(tenant_id, employee_id);

create table if not exists onboarding_check_ins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  due_date date not null,
  status onboarding_check_in_status not null default 'scheduled',
  questions jsonb not null,
  responses jsonb,
  flagged_follow_up boolean not null default false,
  follow_up_risk_signal_id uuid,
  follow_up_action_item_id uuid,
  automation_item_id uuid,
  submitted_at timestamptz,
  submitted_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array'),
  check (responses is null or jsonb_typeof(responses) = 'object'),
  check (
    (status = 'submitted' and submitted_at is not null and responses is not null)
    or (status <> 'submitted' and submitted_at is null)
  ),
  constraint onboarding_check_ins_employee_fk
    foreign key (tenant_id, employee_id)
    references employees(tenant_id, id)
    on delete cascade,
  constraint onboarding_check_ins_automation_fk
    foreign key (tenant_id, automation_item_id)
    references hr_automation_items(tenant_id, id)
    on delete set null,
  constraint onboarding_check_ins_signal_fk
    foreign key (follow_up_risk_signal_id)
    references risk_signals(id)
    on delete set null,
  constraint onboarding_check_ins_action_fk
    foreign key (follow_up_action_item_id)
    references action_items(id)
    on delete set null
);

create unique index if not exists onboarding_check_ins_employee_due_idx
  on onboarding_check_ins(tenant_id, employee_id, due_date);
create index if not exists onboarding_check_ins_status_idx on onboarding_check_ins(tenant_id, status);

create table if not exists probation_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  probation_end_date date not null,
  review_due_date date not null,
  status probation_review_status not null default 'scheduled',
  review_owner_user_id uuid not null,
  manager_input text,
  manager_input_submitted_at timestamptz,
  manager_input_submitted_by_user_id uuid,
  manager_input_automation_item_id uuid,
  outcome probation_review_outcome,
  outcome_notes text,
  completed_at timestamptz,
  completed_by_user_id uuid,
  automation_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_due_date <= probation_end_date),
  check (manager_input is null or char_length(manager_input) <= 1200),
  check (outcome_notes is null or char_length(outcome_notes) <= 1200),
  check (
    (status = 'completed' and outcome is not null and completed_at is not null)
    or (status <> 'completed' and outcome is null and completed_at is null)
  ),
  constraint probation_reviews_employee_fk
    foreign key (tenant_id, employee_id)
    references employees(tenant_id, id)
    on delete cascade,
  constraint probation_reviews_automation_fk
    foreign key (tenant_id, automation_item_id)
    references hr_automation_items(tenant_id, id)
    on delete set null,
  constraint probation_reviews_manager_input_automation_fk
    foreign key (tenant_id, manager_input_automation_item_id)
    references hr_automation_items(tenant_id, id)
    on delete set null
);

alter table probation_reviews add column if not exists manager_input text;
alter table probation_reviews add column if not exists manager_input_submitted_at timestamptz;
alter table probation_reviews add column if not exists manager_input_submitted_by_user_id uuid;
alter table probation_reviews add column if not exists manager_input_automation_item_id uuid;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'probation_reviews_manager_input_automation_fk'
      and conrelid = 'probation_reviews'::regclass
  ) then
    alter table probation_reviews
      add constraint probation_reviews_manager_input_automation_fk
        foreign key (tenant_id, manager_input_automation_item_id)
        references hr_automation_items(tenant_id, id)
        on delete set null;
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create unique index if not exists probation_reviews_employee_end_date_idx
  on probation_reviews(tenant_id, employee_id, probation_end_date);
create index if not exists probation_reviews_status_idx on probation_reviews(tenant_id, status);
create index if not exists probation_reviews_due_idx on probation_reviews(tenant_id, review_due_date);

create unique index if not exists risk_signals_open_check_in_follow_up_unique_idx
  on risk_signals(tenant_id, kind, subject_employee_id)
  where resolved_at is null and kind = 'onboarding_check_in_follow_up';

create or replace function early_employment_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists onboarding_check_ins_set_updated_at on onboarding_check_ins;
create trigger onboarding_check_ins_set_updated_at
before update on onboarding_check_ins
for each row
execute function early_employment_touch_updated_at();

drop trigger if exists probation_reviews_set_updated_at on probation_reviews;
create trigger probation_reviews_set_updated_at
before update on probation_reviews
for each row
execute function early_employment_touch_updated_at();

create or replace function teamframe_onboarding_check_in_questions()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_array(
    jsonb_build_object('key', 'role_clarity', 'label', 'My role and priorities are clear.', 'type', 'choice'),
    jsonb_build_object('key', 'manager_team_clarity', 'label', 'I know who to ask for day-to-day help.', 'type', 'choice'),
    jsonb_build_object('key', 'tools_ready', 'label', 'I have the tools and access I need.', 'type', 'boolean'),
    jsonb_build_object('key', 'training_clear', 'label', 'The onboarding information has been useful.', 'type', 'choice'),
    jsonb_build_object('key', 'policies_clear', 'label', 'I understand the key policies and processes.', 'type', 'choice'),
    jsonb_build_object('key', 'support_available', 'label', 'I know where to get support.', 'type', 'boolean'),
    jsonb_build_object('key', 'has_blockers', 'label', 'Something is blocking my work.', 'type', 'boolean'),
    jsonb_build_object('key', 'improvement_note', 'label', 'One thing that would improve onboarding.', 'type', 'text')
  );
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
  v_check_in_id uuid;
  v_check_in_item_id uuid;
  v_probation_id uuid;
  v_probation_item_id uuid;
  v_probation_manager_input_item_id uuid;
  v_probation_end date;
  v_manager_task_id uuid;
  v_manager_task_item_id uuid;
begin
  select *
  into v_employee
  from employees
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  v_lifecycle := teamframe_derive_employee_lifecycle(
    v_employee.status,
    v_employee.setup_status,
    v_employee.start_date,
    v_employee.end_date,
    v_employee.lifecycle_state
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
      tenant_id,
      employee_id,
      title,
      status,
      owner_role,
      owner_employee_id,
      assigned_by,
      due_date
    )
    values (
      p_tenant_id,
      p_employee_id,
      'Meet your manager',
      'pending',
      'manager',
      v_employee.manager_id,
      p_actor_user_id,
      v_base_date + 2
    )
    returning id into v_manager_task_id;

    v_manager_task_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id,
      'onboarding.manager_task_due',
      'onboarding.manager_task:' || v_manager_task_id::text,
      'onboarding_task',
      v_manager_task_id,
      v_employee.manager_id,
      ((v_base_date + 2)::text || 'T09:00:00Z')::timestamptz,
      'routine_reminder',
      null,
      jsonb_build_object('employee_id', p_employee_id, 'task_id', v_manager_task_id),
      3
    );

    update onboarding_tasks
    set automation_item_id = v_manager_task_item_id
    where tenant_id = p_tenant_id
      and id = v_manager_task_id;
  end if;

  insert into onboarding_check_ins (tenant_id, employee_id, due_date, questions)
  values (p_tenant_id, p_employee_id, v_base_date + 30, teamframe_onboarding_check_in_questions())
  on conflict (tenant_id, employee_id, due_date) do update set updated_at = clock_timestamp()
  returning id into v_check_in_id;

  v_check_in_item_id := teamframe_ensure_hr_automation_item(
    p_tenant_id,
    'onboarding.check_in.due',
    'onboarding.check_in:' || p_employee_id::text || ':' || (v_base_date + 30)::text,
    'onboarding_check_in',
    v_check_in_id,
    p_employee_id,
    ((v_base_date + 30)::text || 'T09:00:00Z')::timestamptz,
    'routine_reminder',
    null,
    jsonb_build_object('employee_id', p_employee_id, 'milestone_days', 30),
    3
  );

  update onboarding_check_ins
  set automation_item_id = v_check_in_item_id
  where tenant_id = p_tenant_id
    and id = v_check_in_id;

  if v_employee.employment_type <> 'contractor' then
    v_probation_end := v_base_date + 90;
    insert into probation_reviews (
      tenant_id,
      employee_id,
      probation_end_date,
      review_due_date,
      review_owner_user_id
    )
    values (
      p_tenant_id,
      p_employee_id,
      v_probation_end,
      v_probation_end - 14,
      p_actor_user_id
    )
    on conflict (tenant_id, employee_id, probation_end_date) do update set updated_at = clock_timestamp()
    returning id into v_probation_id;

    v_probation_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id,
      'probation.review_due',
      'probation.review:' || p_employee_id::text || ':' || v_probation_end::text,
      'probation_review',
      v_probation_id,
      null,
      ((v_probation_end - 14)::text || 'T09:00:00Z')::timestamptz,
      'decision',
      null,
      jsonb_build_object('employee_id', p_employee_id, 'probation_end_date', v_probation_end),
      3
    );

    update probation_reviews
    set automation_item_id = v_probation_item_id
    where tenant_id = p_tenant_id
      and id = v_probation_id;

    if v_employee.manager_id is not null then
      v_probation_manager_input_item_id := teamframe_ensure_hr_automation_item(
        p_tenant_id,
        'probation.manager_input_due',
        'probation.manager_input:' || v_probation_id::text,
        'probation_review',
        v_probation_id,
        v_employee.manager_id,
        ((v_probation_end - 14)::text || 'T09:00:00Z')::timestamptz,
        'routine_reminder',
        null,
        jsonb_build_object('employee_id', p_employee_id, 'probation_end_date', v_probation_end),
        3
      );

      update probation_reviews
      set manager_input_automation_item_id = v_probation_manager_input_item_id
      where tenant_id = p_tenant_id
        and id = v_probation_id;
    end if;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'early_employment.initialized', p_employee_id);

  return jsonb_build_object(
    'initialized', true,
    'onboarding_check_in_id', v_check_in_id,
    'probation_review_id', v_probation_id
  );
end;
$$;

create or replace function teamframe_submit_onboarding_check_in(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_check_in_id uuid,
  p_responses jsonb
)
returns onboarding_check_ins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check_in onboarding_check_ins;
  v_needs_follow_up boolean;
  v_signal_id uuid;
  v_action_id uuid;
begin
  if jsonb_typeof(p_responses) <> 'object' then
    raise exception 'CHECK_IN_RESPONSES_INVALID';
  end if;

  select *
  into v_check_in
  from onboarding_check_ins
  where tenant_id = p_tenant_id
    and id = p_check_in_id
    and employee_id = p_employee_id
    and status = 'scheduled'
  for update;

  if not found then
    raise exception 'CHECK_IN_NOT_FOUND';
  end if;

  v_needs_follow_up :=
    coalesce((p_responses ->> 'has_blockers')::boolean, false)
    or coalesce((p_responses ->> 'tools_ready')::boolean, true) = false
    or coalesce((p_responses ->> 'support_available')::boolean, true) = false
    or lower(coalesce(p_responses ->> 'role_clarity', '')) in ('unclear', 'needs_help')
    or lower(coalesce(p_responses ->> 'manager_team_clarity', '')) in ('unclear', 'needs_help');

  if v_needs_follow_up then
    insert into risk_signals (
      tenant_id,
      kind,
      trigger_reason,
      severity,
      subject_employee_id,
      evidence
    )
    values (
      p_tenant_id,
      'onboarding_check_in_follow_up',
      '30-day check-in response needs admin follow-up',
      'yellow',
      p_employee_id,
      jsonb_build_object('check_in_id', p_check_in_id)
    )
    on conflict (tenant_id, kind, subject_employee_id)
      where resolved_at is null and kind = 'onboarding_check_in_follow_up'
    do update set
      last_seen_at = clock_timestamp(),
      evidence = risk_signals.evidence || excluded.evidence
    returning id into v_signal_id;

    insert into action_items (
      tenant_id,
      risk_signal_id,
      subject_employee_id,
      category,
      title,
      suggested_action,
      status
    )
    values (
      p_tenant_id,
      v_signal_id,
      p_employee_id,
      'Onboarding',
      'Follow up on 30-day onboarding check-in',
      'Review the employee response and remove the blocker or clarify the next step.',
      'open'
    )
    on conflict (tenant_id, risk_signal_id)
      where status in ('open', 'in_progress')
    do update set updated_at = clock_timestamp()
    returning id into v_action_id;
  end if;

  update onboarding_check_ins
  set
    status = 'submitted',
    responses = p_responses,
    flagged_follow_up = v_needs_follow_up,
    follow_up_risk_signal_id = v_signal_id,
    follow_up_action_item_id = v_action_id,
    submitted_at = clock_timestamp(),
    submitted_by_user_id = p_actor_user_id
  where tenant_id = p_tenant_id
    and id = p_check_in_id
  returning * into v_check_in;

  if v_check_in.automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_check_in.automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'onboarding_check_in.submitted')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'onboarding.check_in_submitted', p_check_in_id);

  if v_needs_follow_up then
    insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
    values (p_tenant_id, '00000000-0000-0000-0000-000000000000', 'system', 'onboarding.check_in_follow_up_created', v_action_id);
  end if;

  return v_check_in;
end;
$$;

create or replace function teamframe_complete_probation_review(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_review_id uuid,
  p_outcome probation_review_outcome,
  p_outcome_notes text default null,
  p_extended_until date default null
)
returns probation_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review probation_reviews;
  v_next_review_id uuid;
begin
  select *
  into v_review
  from probation_reviews
  where tenant_id = p_tenant_id
    and id = p_review_id
    and status in ('scheduled', 'due')
  for update;

  if not found then
    raise exception 'PROBATION_REVIEW_NOT_FOUND';
  end if;

  if p_outcome = 'extended' and (p_extended_until is null or p_extended_until <= v_review.probation_end_date) then
    raise exception 'PROBATION_EXTENSION_DATE_INVALID';
  end if;

  update probation_reviews
  set
    status = 'completed',
    outcome = p_outcome,
    outcome_notes = nullif(left(coalesce(p_outcome_notes, ''), 1200), ''),
    completed_at = clock_timestamp(),
    completed_by_user_id = p_actor_user_id
  where tenant_id = p_tenant_id
    and id = p_review_id
  returning * into v_review;

  if v_review.automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_review.automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'probation_review.completed', 'outcome', p_outcome)
    );
  end if;

  if p_outcome = 'extended' then
    insert into probation_reviews (
      tenant_id,
      employee_id,
      probation_end_date,
      review_due_date,
      review_owner_user_id
    )
    values (
      p_tenant_id,
      v_review.employee_id,
      p_extended_until,
      greatest(current_date, p_extended_until - 14),
      p_actor_user_id
    )
    on conflict (tenant_id, employee_id, probation_end_date) do update set updated_at = clock_timestamp()
    returning id into v_next_review_id;

    perform teamframe_ensure_hr_automation_item(
      p_tenant_id,
      'probation.review_due',
      'probation.review:' || v_review.employee_id::text || ':' || p_extended_until::text,
      'probation_review',
      v_next_review_id,
      null,
      ((greatest(current_date, p_extended_until - 14))::text || 'T09:00:00Z')::timestamptz,
      'decision',
      null,
      jsonb_build_object('employee_id', v_review.employee_id, 'probation_end_date', p_extended_until, 'extended_from', p_review_id),
      3
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'probation.review_completed', p_review_id);

  return v_review;
end;
$$;

revoke all on function teamframe_onboarding_check_in_questions() from public, anon, authenticated;
grant execute on function teamframe_onboarding_check_in_questions() to service_role;

revoke all on function teamframe_initialize_join_work(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_initialize_join_work(uuid, uuid, uuid) to service_role;

revoke all on function teamframe_submit_onboarding_check_in(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function teamframe_submit_onboarding_check_in(uuid, uuid, uuid, uuid, jsonb) to service_role;

revoke all on function teamframe_complete_probation_review(uuid, uuid, uuid, probation_review_outcome, text, date) from public, anon, authenticated;
grant execute on function teamframe_complete_probation_review(uuid, uuid, uuid, probation_review_outcome, text, date) to service_role;
