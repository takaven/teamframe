-- TeamFrame MR-7 — bounded offboarding workflow.
-- Exit workflow only: no payroll engine, legal engine, IT integration, or asset inventory.

do $$ begin
  create type offboarding_case_status as enum ('active', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offboarding_item_status as enum ('pending', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offboarding_item_owner_role as enum ('admin', 'manager', 'employee', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offboarding_completion_mode as enum (
    'manual_confirmation',
    'document_required',
    'policy_acknowledgement',
    'form_or_data_required'
  );
exception when duplicate_object then null; end $$;

create table if not exists offboarding_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  effective_end_date date not null,
  status offboarding_case_status not null default 'active',
  started_at timestamptz not null default clock_timestamp(),
  started_by_user_id uuid not null,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid,
  completed_at timestamptz,
  completed_by_actor_type text,
  closure_automation_item_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint offboarding_cases_tenant_id_id_key unique (tenant_id, id),
  constraint offboarding_cases_employee_fk
    foreign key (tenant_id, employee_id)
    references employees(tenant_id, id)
    on delete cascade,
  constraint offboarding_cases_closure_automation_fk
    foreign key (tenant_id, closure_automation_item_id)
    references hr_automation_items(tenant_id, id)
    on delete set null
);

create unique index if not exists offboarding_cases_one_active_idx
  on offboarding_cases(tenant_id, employee_id)
  where status = 'active';
create index if not exists offboarding_cases_employee_idx on offboarding_cases(tenant_id, employee_id, status);
create index if not exists offboarding_cases_end_date_idx on offboarding_cases(tenant_id, status, effective_end_date);

create table if not exists offboarding_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  offboarding_case_id uuid not null,
  employee_id uuid not null,
  item_key text not null check (char_length(trim(item_key)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 200),
  owner_role offboarding_item_owner_role not null,
  owner_employee_id uuid,
  due_date date,
  required boolean not null default true,
  completion_mode offboarding_completion_mode not null default 'manual_confirmation',
  required_document_type text,
  status offboarding_item_status not null default 'pending',
  completed_at timestamptz,
  completed_by_user_id uuid,
  automation_item_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint offboarding_items_case_fk
    foreign key (tenant_id, offboarding_case_id)
    references offboarding_cases(tenant_id, id)
    on delete cascade,
  constraint offboarding_items_employee_fk
    foreign key (tenant_id, employee_id)
    references employees(tenant_id, id)
    on delete cascade,
  constraint offboarding_items_owner_employee_fk
    foreign key (tenant_id, owner_employee_id)
    references employees(tenant_id, id)
    on delete set null,
  constraint offboarding_items_automation_fk
    foreign key (tenant_id, automation_item_id)
    references hr_automation_items(tenant_id, id)
    on delete set null
);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'offboarding_cases_tenant_id_id_key'
      and conrelid = 'offboarding_cases'::regclass
  ) then
    alter table offboarding_cases add constraint offboarding_cases_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create unique index if not exists offboarding_items_case_key_idx
  on offboarding_items(tenant_id, offboarding_case_id, item_key);
create index if not exists offboarding_items_employee_idx on offboarding_items(tenant_id, employee_id, status);
create index if not exists offboarding_items_owner_idx on offboarding_items(tenant_id, owner_employee_id, status)
  where owner_employee_id is not null;
create index if not exists offboarding_items_document_idx on offboarding_items(tenant_id, employee_id, required_document_type)
  where completion_mode = 'document_required' and status = 'pending';

create or replace function offboarding_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists offboarding_cases_set_updated_at on offboarding_cases;
create trigger offboarding_cases_set_updated_at
before update on offboarding_cases
for each row execute function offboarding_touch_updated_at();

drop trigger if exists offboarding_items_set_updated_at on offboarding_items;
create trigger offboarding_items_set_updated_at
before update on offboarding_items
for each row execute function offboarding_touch_updated_at();

create or replace function teamframe_offboarding_due_date(
  p_effective_end_date date,
  p_offset_days integer
)
returns date
language sql
stable
set search_path = public
as $$
  select greatest(current_date, p_effective_end_date + p_offset_days);
$$;

create or replace function teamframe_start_offboarding(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_effective_end_date date,
  p_expected_updated_at timestamptz
)
returns offboarding_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees;
  v_case offboarding_cases;
  v_manager_id uuid;
  v_item offboarding_items;
  v_item_due_at timestamptz;
  v_item_automation_id uuid;
  v_closure_id uuid;
begin
  if p_effective_end_date is null then
    raise exception 'OFFBOARDING_END_DATE_REQUIRED';
  end if;

  select * into v_employee
  from employees
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  if teamframe_derive_employee_lifecycle(
    v_employee.status,
    v_employee.setup_status,
    v_employee.start_date,
    v_employee.end_date,
    v_employee.lifecycle_state
  ) = 'exited' then
    raise exception 'OFFBOARDING_EMPLOYEE_NOT_ELIGIBLE';
  end if;

  select * into v_case
  from offboarding_cases
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id
    and status = 'active'
  for update;

  if found then
    return v_case;
  end if;

  if not teamframe_timestamp_matches(v_employee.updated_at, p_expected_updated_at) then
    return null;
  end if;

  select m.id into v_manager_id
  from employees m
  where m.tenant_id = p_tenant_id
    and m.id = v_employee.manager_id
    and m.deleted_at is null
    and teamframe_derive_employee_lifecycle(m.status, m.setup_status, m.start_date, m.end_date, m.lifecycle_state) = 'active';

  insert into offboarding_cases (
    tenant_id,
    employee_id,
    effective_end_date,
    started_by_user_id
  )
  values (
    p_tenant_id,
    p_employee_id,
    p_effective_end_date,
    p_actor_user_id
  )
  returning * into v_case;

  update employees
  set lifecycle_state = 'offboarding',
      end_date = p_effective_end_date
  where tenant_id = p_tenant_id
    and id = p_employee_id;

  insert into offboarding_items (
    tenant_id,
    offboarding_case_id,
    employee_id,
    item_key,
    title,
    owner_role,
    owner_employee_id,
    due_date,
    required,
    completion_mode,
    required_document_type
  )
  values
    (p_tenant_id, v_case.id, p_employee_id, 'notice_confirmed', 'Confirm final working date and notice details', 'admin', null, teamframe_offboarding_due_date(p_effective_end_date, -14), true, 'manual_confirmation', null),
    (p_tenant_id, v_case.id, p_employee_id, 'handover_plan', 'Complete manager handover notes', 'manager', v_manager_id, teamframe_offboarding_due_date(p_effective_end_date, -7), true, 'manual_confirmation', null),
    (p_tenant_id, v_case.id, p_employee_id, 'leave_reconciliation', 'Review remaining leave and absence record', 'admin', null, teamframe_offboarding_due_date(p_effective_end_date, -5), true, 'manual_confirmation', null),
    (p_tenant_id, v_case.id, p_employee_id, 'final_documents', 'Upload final exit document evidence', 'employee', null, teamframe_offboarding_due_date(p_effective_end_date, -3), true, 'document_required', 'exit_document'),
    (p_tenant_id, v_case.id, p_employee_id, 'access_removal', 'Confirm access-removal handoff', 'admin', null, p_effective_end_date, true, 'manual_confirmation', null),
    (p_tenant_id, v_case.id, p_employee_id, 'asset_return', 'Confirm return of company property where applicable', 'admin', null, p_effective_end_date, true, 'manual_confirmation', null),
    (p_tenant_id, v_case.id, p_employee_id, 'final_hr_review', 'Complete final HR closeout review', 'admin', null, p_effective_end_date, true, 'manual_confirmation', null);

  for v_item in
    select *
    from offboarding_items
    where tenant_id = p_tenant_id
      and offboarding_case_id = v_case.id
      and automation_item_id is null
  loop
    v_item_due_at := (v_item.due_date::text || 'T09:00:00+00')::timestamptz;
    v_item_automation_id := teamframe_ensure_hr_automation_item(
      p_tenant_id,
      'offboarding.item_due',
      'offboarding:' || v_case.id::text || ':item:' || v_item.item_key,
      'offboarding_item',
      v_item.id,
      v_item.owner_employee_id,
      v_item_due_at,
      case
        when v_item.owner_role = 'admin' then 'decision'::hr_automation_notification_level
        else 'routine_reminder'::hr_automation_notification_level
      end,
      null,
      jsonb_build_object('item_key', v_item.item_key, 'owner_role', v_item.owner_role),
      3
    );

    update offboarding_items
    set automation_item_id = v_item_automation_id
    where tenant_id = p_tenant_id
      and id = v_item.id;
  end loop;

  v_closure_id := teamframe_ensure_hr_automation_item(
    p_tenant_id,
    'offboarding.closure_due',
    'offboarding:' || v_case.id::text || ':closure',
    'offboarding_case',
    v_case.id,
    null,
    (p_effective_end_date::text || 'T09:00:00+00')::timestamptz,
    'background',
    null,
    jsonb_build_object('employee_id', p_employee_id),
    3
  );

  update offboarding_cases
  set closure_automation_item_id = v_closure_id
  where tenant_id = p_tenant_id
    and id = v_case.id
  returning * into v_case;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'human', 'offboarding.started', v_case.id);

  return v_case;
end;
$$;

create or replace function teamframe_sync_offboarding_manager_owner(
  p_tenant_id uuid,
  p_employee_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_id uuid;
  v_updated integer := 0;
begin
  select m.id into v_manager_id
  from employees e
  join employees m on m.tenant_id = e.tenant_id and m.id = e.manager_id
  where e.tenant_id = p_tenant_id
    and e.id = p_employee_id
    and e.deleted_at is null
    and m.deleted_at is null
    and teamframe_derive_employee_lifecycle(m.status, m.setup_status, m.start_date, m.end_date, m.lifecycle_state) = 'active';

  update offboarding_items
  set owner_employee_id = v_manager_id
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id
    and status = 'pending'
    and owner_role = 'manager'
    and owner_employee_id is distinct from v_manager_id;

  get diagnostics v_updated = row_count;

  update hr_automation_items a
  set owner_employee_id = i.owner_employee_id
  from offboarding_items i
  where i.tenant_id = p_tenant_id
    and i.employee_id = p_employee_id
    and i.owner_role = 'manager'
    and i.status = 'pending'
    and i.automation_item_id = a.id
    and a.tenant_id = i.tenant_id
    and a.status in ('scheduled', 'due', 'failed', 'escalated')
    and a.owner_employee_id is distinct from i.owner_employee_id;

  return v_updated;
end;
$$;

create or replace function teamframe_evaluate_offboarding_closure(
  p_tenant_id uuid,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_actor_type text default 'system',
  p_as_of date default current_date
)
returns offboarding_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case offboarding_cases;
  v_vacated_position_ids uuid[];
begin
  select * into v_case
  from offboarding_cases
  where tenant_id = p_tenant_id
    and id = p_case_id
    and status = 'active'
  for update;

  if not found then
    return null;
  end if;

  if v_case.effective_end_date > p_as_of then
    return v_case;
  end if;

  if exists (
    select 1
    from offboarding_items
    where tenant_id = p_tenant_id
      and offboarding_case_id = p_case_id
      and required
      and status = 'pending'
  ) then
    return v_case;
  end if;

  update employees
  set status = 'inactive',
      lifecycle_state = 'exited',
      end_date = v_case.effective_end_date,
      deleted_at = coalesce(deleted_at, clock_timestamp())
  where tenant_id = p_tenant_id
    and id = v_case.employee_id
    and deleted_at is null;

  with vacated_positions as (
    update positions
    set assigned_employee_id = null
    where tenant_id = p_tenant_id
      and assigned_employee_id = v_case.employee_id
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_vacated_position_ids
  from vacated_positions;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  select p_tenant_id, p_actor_user_id, p_actor_type, 'position.vacated_by_offboarding_completion', position_id
  from unnest(v_vacated_position_ids) as position_id;

  update onboarding_tasks
  set status = 'completed',
      completed_at = coalesce(completed_at, clock_timestamp())
  where tenant_id = p_tenant_id
    and employee_id = v_case.employee_id
    and status = 'pending'
    and owner_role in ('manager', 'employee');

  update probation_reviews
  set status = 'suppressed'
  where tenant_id = p_tenant_id
    and employee_id = v_case.employee_id
    and status in ('scheduled', 'due');

  update hr_automation_items
  set status = 'suppressed'
  where tenant_id = p_tenant_id
    and owner_employee_id = v_case.employee_id
    and status in ('scheduled', 'due', 'failed', 'escalated');

  update offboarding_cases
  set status = 'completed',
      completed_at = clock_timestamp(),
      completed_by_actor_type = p_actor_type
  where tenant_id = p_tenant_id
    and id = p_case_id
  returning * into v_case;

  if v_case.closure_automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_case.closure_automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'offboarding.closed')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, p_actor_type, 'offboarding.completed', p_case_id);

  return v_case;
end;
$$;

create or replace function teamframe_complete_offboarding_item(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_item_id uuid,
  p_expected_updated_at timestamptz,
  p_as_of date default current_date
)
returns offboarding_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item offboarding_items;
begin
  select * into v_item
  from offboarding_items
  where tenant_id = p_tenant_id
    and id = p_item_id
    and status = 'pending'
    and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
  for update;

  if not found then
    return null;
  end if;

  if v_item.completion_mode <> 'manual_confirmation' then
    raise exception 'EVIDENCE_REQUIRED';
  end if;

  update offboarding_items
  set status = 'completed',
      completed_at = clock_timestamp(),
      completed_by_user_id = p_actor_user_id
  where tenant_id = p_tenant_id
    and id = p_item_id
  returning * into v_item;

  if v_item.automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_item.automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'offboarding.item_completed')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'human', 'offboarding.item_completed', p_item_id);

  perform teamframe_evaluate_offboarding_closure(p_tenant_id, v_item.offboarding_case_id, p_actor_user_id, 'human', p_as_of);
  return v_item;
end;
$$;

create or replace function teamframe_sync_offboarding_document_evidence_tasks(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_document_type text,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_closed integer := 0;
begin
  for v_item in
    update offboarding_items
    set status = 'completed',
        completed_at = clock_timestamp(),
        completed_by_user_id = p_actor_user_id
    where tenant_id = p_tenant_id
      and employee_id = p_employee_id
      and status = 'pending'
      and completion_mode = 'document_required'
      and lower(coalesce(required_document_type, '')) = lower(p_document_type)
    returning *
  loop
    v_closed := v_closed + 1;
    if v_item.automation_item_id is not null then
      perform teamframe_run_hr_automation_item(
        p_tenant_id,
        v_item.automation_item_id,
        clock_timestamp(),
        true,
        false,
        null,
        null,
        null,
        jsonb_build_object('source', 'offboarding.document_evidence_completed')
      );
    end if;
    insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
    values (p_tenant_id, '00000000-0000-0000-0000-000000000000', 'system', 'offboarding.document_evidence_completed', v_item.id);
    perform teamframe_evaluate_offboarding_closure(p_tenant_id, v_item.offboarding_case_id, p_actor_user_id, 'system', current_date);
  end loop;

  return v_closed;
end;
$$;

create or replace function teamframe_cancel_offboarding(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_case_id uuid
)
returns offboarding_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case offboarding_cases;
begin
  select * into v_case
  from offboarding_cases
  where tenant_id = p_tenant_id
    and id = p_case_id
    and status = 'active'
  for update;

  if not found then
    return null;
  end if;

  update offboarding_items
  set status = 'cancelled'
  where tenant_id = p_tenant_id
    and offboarding_case_id = p_case_id
    and status = 'pending';

  update hr_automation_items
  set status = 'suppressed'
  where tenant_id = p_tenant_id
    and subject_id in (
      select id from offboarding_items where tenant_id = p_tenant_id and offboarding_case_id = p_case_id
      union all
      select p_case_id
    )
    and status in ('scheduled', 'due', 'failed', 'escalated');

  update employees
  set lifecycle_state = 'active',
      status = 'active',
      end_date = null
  where tenant_id = p_tenant_id
    and id = v_case.employee_id
    and deleted_at is null
    and lifecycle_state = 'offboarding';

  update offboarding_cases
  set status = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_by_user_id = p_actor_user_id
  where tenant_id = p_tenant_id
    and id = p_case_id
  returning * into v_case;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'human', 'offboarding.cancelled', p_case_id);

  return v_case;
end;
$$;

create or replace function document_requirements_sync_offboarding_evidence_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'accepted'
    and (tg_op = 'INSERT' or old.state is distinct from new.state or old.current_document_id is distinct from new.current_document_id)
  then
    perform teamframe_sync_offboarding_document_evidence_tasks(
      new.tenant_id,
      new.employee_id,
      new.document_type,
      coalesce(new.reviewed_by_user_id, new.requested_by_user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists document_requirements_sync_offboarding_evidence on document_requirements;
create trigger document_requirements_sync_offboarding_evidence
after insert or update on document_requirements
for each row
execute function document_requirements_sync_offboarding_evidence_trigger();

alter table offboarding_cases enable row level security;
alter table offboarding_items enable row level security;

drop policy if exists offboarding_cases_admin_select on offboarding_cases;
create policy offboarding_cases_admin_select on offboarding_cases
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id from employees
      where tenant_id = current_actor_tenant_id()
        and lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);

drop policy if exists offboarding_cases_admin_write on offboarding_cases;
create policy offboarding_cases_admin_write on offboarding_cases
for all
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id())
with check (is_current_actor_admin() and tenant_id = current_actor_tenant_id());

drop policy if exists offboarding_items_select on offboarding_items;
create policy offboarding_items_select on offboarding_items
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    is_current_actor_admin()
    or employee_id in (
      select id from employees
      where tenant_id = current_actor_tenant_id()
        and lower(email) = current_actor_email()
        and deleted_at is null
    )
    or owner_employee_id in (
      select id from employees
      where tenant_id = current_actor_tenant_id()
        and lower(email) = current_actor_email()
        and deleted_at is null
    )
  )
);

drop policy if exists offboarding_items_admin_write on offboarding_items;
create policy offboarding_items_admin_write on offboarding_items
for all
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id())
with check (is_current_actor_admin() and tenant_id = current_actor_tenant_id());

revoke all on function teamframe_sync_offboarding_manager_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function teamframe_start_offboarding(uuid, uuid, uuid, date, timestamptz) from public, anon, authenticated;
revoke all on function teamframe_evaluate_offboarding_closure(uuid, uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function teamframe_complete_offboarding_item(uuid, uuid, uuid, timestamptz, date) from public, anon, authenticated;
revoke all on function teamframe_sync_offboarding_document_evidence_tasks(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function teamframe_cancel_offboarding(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function teamframe_sync_offboarding_manager_owner(uuid, uuid) to service_role;
grant execute on function teamframe_start_offboarding(uuid, uuid, uuid, date, timestamptz) to service_role;
grant execute on function teamframe_evaluate_offboarding_closure(uuid, uuid, uuid, text, date) to service_role;
grant execute on function teamframe_complete_offboarding_item(uuid, uuid, uuid, timestamptz, date) to service_role;
grant execute on function teamframe_sync_offboarding_document_evidence_tasks(uuid, uuid, text, uuid) to service_role;
grant execute on function teamframe_cancel_offboarding(uuid, uuid, uuid) to service_role;
