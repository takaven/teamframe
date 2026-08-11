-- TeamFrame MR-3A — effective-dated employment changes.
--
-- This is a bounded people-truth model. It preserves before/after facts for
-- material employee and organisation changes, applies immediate changes with
-- history, and schedules future changes through the locked MR-2 automation
-- layer. It is not a generic temporal database or approval workflow engine.

do $$ begin
  create type employment_change_status as enum (
    'pending',
    'applied',
    'cancelled',
    'superseded',
    'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists employment_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  effective_date date not null,
  status employment_change_status not null default 'pending',
  change_keys text[] not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  recorded_by_user_id uuid not null,
  recorded_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by_actor_type text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid,
  automation_item_id uuid,
  idempotency_key text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(change_keys, 1) > 0),
  check (char_length(idempotency_key) between 1 and 180),
  check (applied_by_actor_type is null or applied_by_actor_type in ('human', 'system')),
  check (error_message is null or char_length(error_message) <= 1000)
);

do $$ begin
  alter table employment_changes
    add constraint employment_changes_tenant_id_id_key unique (tenant_id, id);
exception when duplicate_object then null; when duplicate_table then null; end $$;

create unique index if not exists employment_changes_idempotency_idx
  on employment_changes(tenant_id, idempotency_key);
create index if not exists employment_changes_employee_idx
  on employment_changes(tenant_id, employee_id, effective_date);
create index if not exists employment_changes_pending_due_idx
  on employment_changes(tenant_id, status, effective_date)
  where status = 'pending';

do $$ begin
  alter table employment_changes
    add constraint employment_changes_tenant_employee_fk
      foreign key (tenant_id, employee_id)
      references employees(tenant_id, id)
      on delete restrict;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  alter table employment_changes
    add constraint employment_changes_automation_item_fk
      foreign key (tenant_id, automation_item_id)
      references hr_automation_items(tenant_id, id)
      on delete set null;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create or replace function employment_changes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists employment_changes_set_updated_at on employment_changes;
create trigger employment_changes_set_updated_at
before update on employment_changes
for each row
execute function employment_changes_touch_updated_at();

create or replace function teamframe_employment_change_keys(p_patch jsonb)
returns text[]
language plpgsql
immutable
as $$
declare
  v_keys text[] := array[]::text[];
  v_key text;
  v_allowed constant text[] := array[
    'role_title',
    'department',
    'manager_id',
    'position_id',
    'employment_type',
    'country',
    'grade',
    'start_date',
    'end_date',
    'compensation'
  ];
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'EMPLOYMENT_CHANGE_EMPTY';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not v_key = any(v_allowed) then
      raise exception 'EMPLOYMENT_CHANGE_FIELD_UNSUPPORTED';
    end if;
    v_keys := array_append(v_keys, v_key);
  end loop;
  return v_keys;
end;
$$;

create or replace function teamframe_current_employment_values(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_keys text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee employees;
  v_position_id uuid;
  v_compensation compensation;
  v_values jsonb := '{}'::jsonb;
  v_key text;
begin
  select *
  into v_employee
  from employees
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  select id
  into v_position_id
  from positions
  where tenant_id = p_tenant_id
    and assigned_employee_id = p_employee_id
    and deleted_at is null
  order by updated_at desc
  limit 1;

  select *
  into v_compensation
  from compensation
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id;

  foreach v_key in array p_keys loop
    v_values := v_values || jsonb_build_object(
      v_key,
      case v_key
        when 'role_title' then to_jsonb(v_employee.role_title)
        when 'department' then to_jsonb(v_employee.department)
        when 'manager_id' then to_jsonb(v_employee.manager_id)
        when 'position_id' then to_jsonb(v_position_id)
        when 'employment_type' then to_jsonb(v_employee.employment_type)
        when 'country' then to_jsonb(v_employee.country)
        when 'grade' then to_jsonb(v_employee.grade)
        when 'start_date' then to_jsonb(v_employee.start_date)
        when 'end_date' then to_jsonb(v_employee.end_date)
        when 'compensation' then to_jsonb(v_compensation)
        else 'null'::jsonb
      end
    );
  end loop;

  return v_values;
end;
$$;

create or replace function teamframe_apply_employment_change(
  p_tenant_id uuid,
  p_change_id uuid,
  p_actor_user_id uuid default '00000000-0000-0000-0000-000000000000',
  p_actor_type text default 'system',
  p_effective_as_of date default current_date
)
returns employment_changes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change employment_changes;
  v_employee employees;
  v_new_position_id uuid;
  v_position positions;
  v_comp jsonb;
begin
  select *
  into v_change
  from employment_changes
  where tenant_id = p_tenant_id
    and id = p_change_id
  for update;

  if not found then
    raise exception 'EMPLOYMENT_CHANGE_NOT_FOUND';
  end if;

  if v_change.status = 'applied' then
    return v_change;
  end if;
  if v_change.status <> 'pending' then
    raise exception 'EMPLOYMENT_CHANGE_NOT_PENDING';
  end if;
  if v_change.effective_date > p_effective_as_of then
    raise exception 'EMPLOYMENT_CHANGE_NOT_DUE';
  end if;

  select *
  into v_employee
  from employees
  where tenant_id = p_tenant_id
    and id = v_change.employee_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if v_change.new_values ? 'manager_id'
    and jsonb_typeof(v_change.new_values -> 'manager_id') <> 'null' then
    if (v_change.new_values ->> 'manager_id')::uuid = v_change.employee_id then
      raise exception 'EMPLOYEE_MANAGER_SELF';
    end if;
    perform 1
    from employees
    where tenant_id = p_tenant_id
      and id = (v_change.new_values ->> 'manager_id')::uuid
      and deleted_at is null;
    if not found then
      raise exception 'EMPLOYEE_MANAGER_NOT_FOUND';
    end if;
  end if;

  if v_change.new_values ? 'position_id' then
    if jsonb_typeof(v_change.new_values -> 'position_id') = 'null' then
      update positions
      set assigned_employee_id = null
      where tenant_id = p_tenant_id
        and assigned_employee_id = v_change.employee_id
        and deleted_at is null;
    else
      v_new_position_id := (v_change.new_values ->> 'position_id')::uuid;
      select *
      into v_position
      from positions
      where tenant_id = p_tenant_id
        and id = v_new_position_id
        and deleted_at is null
      for update;

      if not found then
        raise exception 'POSITION_NOT_FOUND';
      end if;
      if v_position.assigned_employee_id is not null
        and v_position.assigned_employee_id <> v_change.employee_id then
        raise exception 'POSITION_ALREADY_FILLED';
      end if;

      update positions
      set assigned_employee_id = null
      where tenant_id = p_tenant_id
        and assigned_employee_id = v_change.employee_id
        and id <> v_new_position_id
        and deleted_at is null;

      update positions
      set assigned_employee_id = v_change.employee_id
      where tenant_id = p_tenant_id
        and id = v_new_position_id
        and deleted_at is null;
    end if;
  end if;

  update employees
  set
    role_title = case when v_change.new_values ? 'role_title' then v_change.new_values ->> 'role_title' else role_title end,
    department = case when v_change.new_values ? 'department' then v_change.new_values ->> 'department' else department end,
    manager_id = case
      when v_change.new_values ? 'manager_id' and jsonb_typeof(v_change.new_values -> 'manager_id') = 'null' then null
      when v_change.new_values ? 'manager_id' then (v_change.new_values ->> 'manager_id')::uuid
      else manager_id
    end,
    employment_type = case when v_change.new_values ? 'employment_type' then (v_change.new_values ->> 'employment_type')::employment_type else employment_type end,
    country = case when v_change.new_values ? 'country' then v_change.new_values ->> 'country' else country end,
    grade = case
      when v_change.new_values ? 'grade' and jsonb_typeof(v_change.new_values -> 'grade') = 'null' then null
      when v_change.new_values ? 'grade' then v_change.new_values ->> 'grade'
      else grade
    end,
    start_date = case when v_change.new_values ? 'start_date' then (v_change.new_values ->> 'start_date')::date else start_date end,
    end_date = case
      when v_change.new_values ? 'end_date' and jsonb_typeof(v_change.new_values -> 'end_date') = 'null' then null
      when v_change.new_values ? 'end_date' then (v_change.new_values ->> 'end_date')::date
      else end_date
    end,
    lifecycle_state = teamframe_derive_employee_lifecycle(
      status,
      setup_status,
      case when v_change.new_values ? 'start_date' then (v_change.new_values ->> 'start_date')::date else start_date end,
      case
        when v_change.new_values ? 'end_date' and jsonb_typeof(v_change.new_values -> 'end_date') = 'null' then null
        when v_change.new_values ? 'end_date' then (v_change.new_values ->> 'end_date')::date
        else end_date
      end,
      lifecycle_state
    )
  where tenant_id = p_tenant_id
    and id = v_change.employee_id
    and deleted_at is null;

  if v_change.new_values ? 'compensation' then
    v_comp := v_change.new_values -> 'compensation';
    insert into compensation (tenant_id, employee_id, base_salary, currency, grade_band)
    values (
      p_tenant_id,
      v_change.employee_id,
      (v_comp ->> 'base_salary')::numeric,
      (v_comp ->> 'currency')::char(3),
      v_comp ->> 'grade_band'
    )
    on conflict (employee_id)
    do update set
      base_salary = excluded.base_salary,
      currency = excluded.currency,
      grade_band = excluded.grade_band;
  end if;

  update employment_changes
  set status = 'applied',
    applied_at = clock_timestamp(),
    applied_by_actor_type = p_actor_type,
    error_message = null
  where tenant_id = p_tenant_id
    and id = p_change_id
  returning * into v_change;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (
    p_tenant_id,
    coalesce(p_actor_user_id, '00000000-0000-0000-0000-000000000000'),
    case when p_actor_type = 'system' then 'system' else 'human' end,
    'employment_change.applied',
    p_change_id
  );

  return v_change;
end;
$$;

create or replace function teamframe_record_employment_change(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_effective_date date,
  p_patch jsonb,
  p_idempotency_key text default null
)
returns employment_changes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
  v_old_values jsonb;
  v_change employment_changes;
  v_automation_id uuid;
  v_idempotency_key text;
begin
  v_keys := teamframe_employment_change_keys(p_patch);
  v_idempotency_key := coalesce(
    p_idempotency_key,
    'employment_change:' || p_employee_id::text || ':' || p_effective_date::text || ':' || array_to_string(v_keys, ',')
  );

  perform 1
  from employees
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if exists (
    select 1
    from employment_changes
    where tenant_id = p_tenant_id
      and employee_id = p_employee_id
      and effective_date = p_effective_date
      and status = 'pending'
      and change_keys && v_keys
      and idempotency_key <> v_idempotency_key
  ) then
    raise exception 'EMPLOYMENT_CHANGE_CONFLICT';
  end if;

  v_old_values := teamframe_current_employment_values(p_tenant_id, p_employee_id, v_keys);

  insert into employment_changes (
    tenant_id,
    employee_id,
    effective_date,
    status,
    change_keys,
    old_values,
    new_values,
    recorded_by_user_id,
    idempotency_key
  )
  values (
    p_tenant_id,
    p_employee_id,
    p_effective_date,
    'pending'::employment_change_status,
    v_keys,
    v_old_values,
    p_patch,
    p_actor_user_id,
    v_idempotency_key
  )
  on conflict (tenant_id, idempotency_key)
  do update set updated_at = clock_timestamp()
  returning * into v_change;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  select p_tenant_id, p_actor_user_id, 'human', 'employment_change.recorded', v_change.id
  where not exists (
    select 1
    from audit_logs
    where tenant_id = p_tenant_id
      and action_type = 'employment_change.recorded'
      and target_id = v_change.id
  );

  if p_effective_date <= current_date then
    return teamframe_apply_employment_change(p_tenant_id, v_change.id, p_actor_user_id, 'human', current_date);
  end if;

  v_automation_id := teamframe_ensure_hr_automation_item(
    p_tenant_id,
    'employment_change.apply',
    'employment_change.apply:' || v_change.id::text,
    'employment_change',
    v_change.id,
    null,
    p_effective_date::timestamptz,
    'background',
    null,
    jsonb_build_object('employee_id', p_employee_id, 'change_keys', v_keys),
    3
  );

  update employment_changes
  set automation_item_id = v_automation_id
  where tenant_id = p_tenant_id
    and id = v_change.id
  returning * into v_change;

  return v_change;
end;
$$;

create or replace function teamframe_cancel_employment_change(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_change_id uuid
)
returns employment_changes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change employment_changes;
begin
  select *
  into v_change
  from employment_changes
  where tenant_id = p_tenant_id
    and id = p_change_id
  for update;

  if not found then
    raise exception 'EMPLOYMENT_CHANGE_NOT_FOUND';
  end if;
  if v_change.status = 'applied' then
    raise exception 'EMPLOYMENT_CHANGE_ALREADY_APPLIED';
  end if;
  if v_change.status <> 'pending' then
    return v_change;
  end if;

  update employment_changes
  set status = 'cancelled',
    cancelled_at = clock_timestamp(),
    cancelled_by_user_id = p_actor_user_id
  where tenant_id = p_tenant_id
    and id = p_change_id
  returning * into v_change;

  if v_change.automation_item_id is not null then
    update hr_automation_items
    set status = 'suppressed',
      completed_at = coalesce(completed_at, clock_timestamp())
    where tenant_id = p_tenant_id
      and id = v_change.automation_item_id
      and status <> 'completed';
  end if;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'human', 'employment_change.cancelled', p_change_id);

  return v_change;
end;
$$;

revoke all on function teamframe_employment_change_keys(jsonb) from public, anon, authenticated;
revoke all on function teamframe_current_employment_values(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function teamframe_record_employment_change(uuid, uuid, uuid, date, jsonb, text) from public, anon, authenticated;
revoke all on function teamframe_apply_employment_change(uuid, uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function teamframe_cancel_employment_change(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function teamframe_employment_change_keys(jsonb) to service_role;
grant execute on function teamframe_current_employment_values(uuid, uuid, text[]) to service_role;
grant execute on function teamframe_record_employment_change(uuid, uuid, uuid, date, jsonb, text) to service_role;
grant execute on function teamframe_apply_employment_change(uuid, uuid, uuid, text, date) to service_role;
grant execute on function teamframe_cancel_employment_change(uuid, uuid, uuid) to service_role;
