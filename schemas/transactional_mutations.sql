-- TeamFrame hardening — transactional database mutations with audit evidence.

create or replace function teamframe_derive_employee_lifecycle(
  p_status employee_status,
  p_setup_status employee_setup_status,
  p_start_date date,
  p_end_date date,
  p_requested_lifecycle employee_lifecycle_state default null
)
returns employee_lifecycle_state
language plpgsql
stable
set search_path = public
as $$
begin
  if p_status = 'inactive' or p_requested_lifecycle = 'exited' then
    return 'exited';
  end if;

  if p_requested_lifecycle = 'offboarding' then
    return 'offboarding';
  end if;

  if p_requested_lifecycle = 'preboarding' or (p_start_date is not null and p_start_date > current_date) then
    return 'preboarding';
  end if;

  if p_setup_status <> 'active' then
    return 'preboarding';
  end if;

  return 'active';
end;
$$;

create or replace function teamframe_timestamp_matches(
  p_actual timestamptz,
  p_expected timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_actual = p_expected
    or abs(extract(epoch from (p_actual - p_expected))) < 0.001;
$$;

create or replace function teamframe_complete_company_setup(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_name text,
  p_country text,
  p_location text,
  p_annual_leave_default_days integer,
  p_sick_leave_default_days integer
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
begin
  update companies
  set
    name = p_name,
    country = p_country,
    location = nullif(p_location, ''),
    annual_leave_default_days = p_annual_leave_default_days,
    sick_leave_default_days = p_sick_leave_default_days,
    unpaid_leave_enabled = true,
    other_leave_enabled = true,
    setup_completed_at = coalesce(setup_completed_at, clock_timestamp()),
    setup_completed_by = coalesce(setup_completed_by, p_actor_user_id)
  where id = p_tenant_id
    and archived_at is null
  returning * into v_company;

  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'company.setup_completed', p_tenant_id);

  return v_company;
end;
$$;

create or replace function teamframe_complete_guided_company_setup(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_name text,
  p_country text,
  p_location text,
  p_annual_leave_default_days integer,
  p_sick_leave_default_days integer,
  p_positions jsonb,
  p_employees jsonb
)
returns companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies;
  v_employee_item jsonb;
  v_position_item jsonb;
  v_employee employees;
  v_position positions;
  v_parent_position_id uuid;
  v_assigned_employee_id uuid;
  v_role_key text;
  v_parent_key text;
  v_role_count integer;
begin
  if jsonb_typeof(p_positions) <> 'array' or jsonb_array_length(p_positions) = 0 then
    raise exception 'SETUP_POSITION_LINE_INVALID';
  end if;

  if jsonb_typeof(p_employees) <> 'array' or jsonb_array_length(p_employees) = 0 then
    raise exception 'SETUP_EMPLOYEE_LINE_INVALID';
  end if;

  select *
  into v_company
  from companies
  where id = p_tenant_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  if v_company.setup_completed_at is not null then
    raise exception 'SETUP_ALREADY_COMPLETED';
  end if;

  create temp table if not exists setup_employee_roles (
    role_key text not null,
    employee_id uuid not null
  ) on commit drop;
  truncate setup_employee_roles;

  create temp table if not exists setup_position_ids (
    title_key text primary key,
    position_id uuid not null
  ) on commit drop;
  truncate setup_position_ids;

  for v_employee_item in select value from jsonb_array_elements(p_employees) loop
    insert into employees (
      tenant_id,
      full_name,
      email,
      role_title,
      department,
      timezone,
      employment_type,
      country,
      start_date,
      status,
      lifecycle_state,
      setup_status
    )
    values (
      p_tenant_id,
      v_employee_item ->> 'fullName',
      lower(v_employee_item ->> 'email'),
      v_employee_item ->> 'roleTitle',
      v_employee_item ->> 'department',
      'UTC',
      'full_time',
      p_country,
      (v_employee_item ->> 'startDate')::date,
      'active',
      teamframe_derive_employee_lifecycle(
        'active',
        'incomplete',
        (v_employee_item ->> 'startDate')::date,
        null,
        null
      ),
      'incomplete'
    )
    returning * into v_employee;

    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'employee.created', v_employee.id);

    perform teamframe_initialize_join_work(p_tenant_id, p_actor_user_id, v_employee.id);

    insert into setup_employee_roles (role_key, employee_id)
    values (lower(trim(v_employee.role_title)), v_employee.id);
  end loop;

  for v_position_item in select value from jsonb_array_elements(p_positions) loop
    v_parent_position_id := null;
    v_assigned_employee_id := null;
    v_role_key := lower(trim(v_position_item ->> 'title'));
    v_parent_key := nullif(lower(trim(coalesce(v_position_item ->> 'reportsToTitle', ''))), '');

    if v_parent_key is not null then
      select position_id
      into v_parent_position_id
      from setup_position_ids
      where title_key = v_parent_key;

      if v_parent_position_id is null then
        raise exception 'SETUP_POSITION_PARENT_UNKNOWN';
      end if;
    end if;

    select count(*)::int, (array_agg(employee_id))[1]
    into v_role_count, v_assigned_employee_id
    from setup_employee_roles
    where role_key = v_role_key;

    if v_role_count <> 1 then
      v_assigned_employee_id := null;
    end if;

    insert into positions (
      tenant_id,
      title,
      department,
      parent_position_id,
      assigned_employee_id,
      note
    )
    values (
      p_tenant_id,
      v_position_item ->> 'title',
      v_position_item ->> 'department',
      v_parent_position_id,
      v_assigned_employee_id,
      null
    )
    returning * into v_position;

    insert into setup_position_ids (title_key, position_id)
    values (v_role_key, v_position.id);

    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'position.created', v_position.id);

    if v_parent_position_id is not null then
      insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
      values (p_tenant_id, p_actor_user_id, 'position.reporting_changed', v_position.id);
    end if;

    if v_assigned_employee_id is not null then
      insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
      values (p_tenant_id, p_actor_user_id, 'position.employee_assigned', v_position.id);
    end if;
  end loop;

  update companies
  set
    name = p_name,
    country = p_country,
    location = nullif(p_location, ''),
    annual_leave_default_days = p_annual_leave_default_days,
    sick_leave_default_days = p_sick_leave_default_days,
    unpaid_leave_enabled = true,
    other_leave_enabled = true,
    setup_completed_at = clock_timestamp(),
    setup_completed_by = p_actor_user_id
  where id = p_tenant_id
  returning * into v_company;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'company.setup_completed', p_tenant_id);

  return v_company;
end;
$$;

create or replace function teamframe_create_employee(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_full_name text,
  p_email text,
  p_role_title text,
  p_department text,
  p_timezone text,
  p_employment_type employment_type,
  p_country text,
  p_start_date date,
  p_end_date date,
  p_manager_id uuid,
  p_grade text,
  p_status employee_status,
  p_setup_status employee_setup_status
)
returns employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees;
begin
  insert into employees (
    tenant_id,
    full_name,
    email,
    role_title,
    department,
    timezone,
    employment_type,
    country,
    start_date,
    end_date,
    manager_id,
    grade,
    status,
    lifecycle_state,
    setup_status
  )
  values (
    p_tenant_id,
    p_full_name,
    p_email,
    p_role_title,
    p_department,
    p_timezone,
    p_employment_type,
    p_country,
    p_start_date,
    p_end_date,
    p_manager_id,
    p_grade,
    p_status,
    teamframe_derive_employee_lifecycle(p_status, p_setup_status, p_start_date, p_end_date, null),
    p_setup_status
  )
  returning * into v_employee;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.created', v_employee.id);

  perform teamframe_initialize_join_work(p_tenant_id, p_actor_user_id, v_employee.id);

  return v_employee;
end;
$$;

create or replace function teamframe_update_employee(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb
)
returns employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees;
  v_material_patch jsonb := '{}'::jsonb;
begin
  if p_patch ? 'role_title' then
    v_material_patch := v_material_patch || jsonb_build_object('role_title', p_patch -> 'role_title');
    p_patch := p_patch - 'role_title';
  end if;
  if p_patch ? 'department' then
    v_material_patch := v_material_patch || jsonb_build_object('department', p_patch -> 'department');
    p_patch := p_patch - 'department';
  end if;
  if p_patch ? 'manager_id' then
    v_material_patch := v_material_patch || jsonb_build_object('manager_id', p_patch -> 'manager_id');
    p_patch := p_patch - 'manager_id';
  end if;
  if p_patch ? 'employment_type' then
    v_material_patch := v_material_patch || jsonb_build_object('employment_type', p_patch -> 'employment_type');
    p_patch := p_patch - 'employment_type';
  end if;
  if p_patch ? 'country' then
    v_material_patch := v_material_patch || jsonb_build_object('country', p_patch -> 'country');
    p_patch := p_patch - 'country';
  end if;
  if p_patch ? 'grade' then
    v_material_patch := v_material_patch || jsonb_build_object('grade', p_patch -> 'grade');
    p_patch := p_patch - 'grade';
  end if;
  if p_patch ? 'start_date' then
    v_material_patch := v_material_patch || jsonb_build_object('start_date', p_patch -> 'start_date');
    p_patch := p_patch - 'start_date';
  end if;
  if p_patch ? 'end_date' then
    v_material_patch := v_material_patch || jsonb_build_object('end_date', p_patch -> 'end_date');
    p_patch := p_patch - 'end_date';
  end if;

  if v_material_patch <> '{}'::jsonb then
    perform 1
    from employees
    where tenant_id = p_tenant_id
      and id = p_employee_id
      and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
      and deleted_at is null;

    if not found then
      return null;
    end if;

    perform teamframe_record_employment_change(
      p_tenant_id,
      p_actor_user_id,
      p_employee_id,
      current_date,
      v_material_patch,
      'employee_update:' || p_employee_id::text || ':' || clock_timestamp()::text
    );

    if p_patch = '{}'::jsonb then
      select *
      into v_employee
      from employees
      where tenant_id = p_tenant_id
        and id = p_employee_id
        and deleted_at is null;

      return v_employee;
    end if;
  end if;

  update employees
  set
    full_name = case when p_patch ? 'full_name' then p_patch ->> 'full_name' else full_name end,
    role_title = case when p_patch ? 'role_title' then p_patch ->> 'role_title' else role_title end,
    department = case when p_patch ? 'department' then p_patch ->> 'department' else department end,
    timezone = case when p_patch ? 'timezone' then p_patch ->> 'timezone' else timezone end,
    employment_type = case when p_patch ? 'employment_type' then (p_patch ->> 'employment_type')::employment_type else employment_type end,
    country = case when p_patch ? 'country' then p_patch ->> 'country' else country end,
    start_date = case when p_patch ? 'start_date' then (p_patch ->> 'start_date')::date else start_date end,
    end_date = case
      when p_patch ? 'end_date' and jsonb_typeof(p_patch -> 'end_date') = 'null' then null
      when p_patch ? 'end_date' then (p_patch ->> 'end_date')::date
      else end_date
    end,
    manager_id = case
      when p_patch ? 'manager_id' and jsonb_typeof(p_patch -> 'manager_id') = 'null' then null
      when p_patch ? 'manager_id' then (p_patch ->> 'manager_id')::uuid
      else manager_id
    end,
    grade = case
      when p_patch ? 'grade' and jsonb_typeof(p_patch -> 'grade') = 'null' then null
      when p_patch ? 'grade' then p_patch ->> 'grade'
      else grade
    end,
    status = case when p_patch ? 'status' then (p_patch ->> 'status')::employee_status else status end,
    lifecycle_state = teamframe_derive_employee_lifecycle(
      case when p_patch ? 'status' then (p_patch ->> 'status')::employee_status else status end,
      case when p_patch ? 'setup_status' then (p_patch ->> 'setup_status')::employee_setup_status else setup_status end,
      case when p_patch ? 'start_date' then (p_patch ->> 'start_date')::date else start_date end,
      case
        when p_patch ? 'end_date' and jsonb_typeof(p_patch -> 'end_date') = 'null' then null
        when p_patch ? 'end_date' then (p_patch ->> 'end_date')::date
        else end_date
      end,
      case when p_patch ? 'lifecycle_state' then (p_patch ->> 'lifecycle_state')::employee_lifecycle_state else lifecycle_state end
    ),
    setup_status = case when p_patch ? 'setup_status' then (p_patch ->> 'setup_status')::employee_setup_status else setup_status end
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and (v_material_patch <> '{}'::jsonb or teamframe_timestamp_matches(updated_at, p_expected_updated_at))
    and deleted_at is null
  returning * into v_employee;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.updated', p_employee_id);

  return v_employee;
end;
$$;

create or replace function teamframe_archive_employee(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_expected_updated_at timestamptz
)
returns employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees;
  v_vacated_position_ids uuid[] := '{}';
begin
  update employees
  set
    deleted_at = clock_timestamp(),
    status = 'inactive',
    lifecycle_state = 'exited'
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
    and deleted_at is null
  returning * into v_employee;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.archived', p_employee_id);

  with vacated_positions as (
    update positions
    set assigned_employee_id = null
    where tenant_id = p_tenant_id
      and assigned_employee_id = p_employee_id
      and deleted_at is null
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_vacated_position_ids
  from vacated_positions;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  select p_tenant_id, p_actor_user_id, 'position.vacated_by_employee_archive', position_id
  from unnest(v_vacated_position_ids) as position_id;

  return v_employee;
end;
$$;

drop function if exists teamframe_submit_leave(uuid, uuid, uuid, date, date);
drop function if exists teamframe_decide_leave(uuid, uuid, uuid, leave_status, timestamptz);

create or replace function teamframe_calculate_leave_days(
  p_start_date date,
  p_end_date date
)
returns numeric
language sql
immutable
as $$
  select count(*)::numeric
  from generate_series(p_start_date, p_end_date, interval '1 day') as leave_day(day)
  where extract(isodow from leave_day.day) between 1 and 5
$$;

create or replace function teamframe_submit_leave(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_leave_type leave_type default 'annual',
  p_reason text default null
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
  v_employee employees;
  v_days numeric(6,2);
  v_automation_item_id uuid;
begin
  if p_end_date < p_start_date then
    raise exception 'INVALID_INPUT';
  end if;

  if p_leave_type = 'annual' and extract(year from p_start_date) <> extract(year from p_end_date) then
    raise exception 'LEAVE_PERIOD_CROSSING';
  end if;

  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_employee
  from employees
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'LEAVE_EMPLOYEE_NOT_ELIGIBLE';
  end if;

  if teamframe_derive_employee_lifecycle(
    v_employee.status,
    v_employee.setup_status,
    v_employee.start_date,
    v_employee.end_date,
    v_employee.lifecycle_state
  ) not in ('active', 'offboarding') then
    raise exception 'LEAVE_EMPLOYEE_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from leaves l
    where l.tenant_id = p_tenant_id
      and l.employee_id = p_employee_id
      and l.status in ('pending', 'approved')
      and l.start_date <= p_end_date
      and p_start_date <= l.end_date
  ) then
    raise exception 'LEAVE_OVERLAP';
  end if;

  v_days := teamframe_calculate_leave_days(p_start_date, p_end_date);
  if v_days <= 0 then
    raise exception 'INVALID_INPUT';
  end if;

  insert into leaves (
    tenant_id,
    employee_id,
    start_date,
    end_date,
    leave_type,
    requested_days,
    reason,
    status
  )
  values (
    p_tenant_id,
    p_employee_id,
    p_start_date,
    p_end_date,
    p_leave_type,
    v_days,
    nullif(trim(coalesce(p_reason, '')), ''),
    'pending'
  )
  returning * into v_leave;

  v_automation_item_id := teamframe_ensure_hr_automation_item(
    p_tenant_id,
    'leave.approval_due',
    'leave:' || v_leave.id::text || ':approval',
    'leave',
    v_leave.id,
    p_employee_id,
    clock_timestamp() + interval '1 day',
    'decision',
    null,
    jsonb_build_object('leave_type', p_leave_type, 'requested_days', v_days),
    3
  );

  update leaves
  set approval_automation_item_id = v_automation_item_id
  where tenant_id = p_tenant_id
    and id = v_leave.id
  returning * into v_leave;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'leave.submitted', v_leave.id);

  return v_leave;
end;
$$;

create or replace function teamframe_decide_leave(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_leave_id uuid,
  p_decision leave_status,
  p_expected_updated_at timestamptz,
  p_override_insufficient_balance boolean default false,
  p_override_reason text default null,
  p_decision_note text default null
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
  v_company companies;
  v_allocation numeric(8,2);
  v_pending numeric(8,2);
  v_approved numeric(8,2);
  v_available numeric(8,2);
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_INPUT';
  end if;

  if p_override_insufficient_balance and nullif(trim(coalesce(p_override_reason, '')), '') is null then
    raise exception 'LEAVE_OVERRIDE_REASON_REQUIRED';
  end if;

  if p_decision_note is not null and char_length(p_decision_note) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_leave
  from leaves
  where tenant_id = p_tenant_id
    and id = p_leave_id
    and status = 'pending'
    and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
  for update;

  if not found then
    return null;
  end if;

  perform 1
  from employees
  where tenant_id = p_tenant_id
    and id = v_leave.employee_id
  for update;

  if p_decision = 'approved' then
    if exists (
      select 1
      from leaves l
      where l.tenant_id = p_tenant_id
        and l.employee_id = v_leave.employee_id
        and l.id <> v_leave.id
        and l.status = 'approved'
        and l.start_date <= v_leave.end_date
        and v_leave.start_date <= l.end_date
    ) then
      raise exception 'LEAVE_OVERLAP';
    end if;

    if v_leave.leave_type = 'annual' then
      select * into v_company
      from companies
      where id = p_tenant_id
      for update;

      v_allocation := coalesce(v_company.annual_leave_default_days, 0)::numeric;
      select coalesce(sum(l.requested_days), 0)
      into v_pending
      from leaves l
      where l.tenant_id = p_tenant_id
        and l.employee_id = v_leave.employee_id
        and l.leave_type = 'annual'
        and l.status = 'pending'
        and l.id <> v_leave.id
        and extract(year from l.start_date) = extract(year from v_leave.start_date);

      select coalesce(sum(l.requested_days), 0)
      into v_approved
      from leaves l
      where l.tenant_id = p_tenant_id
        and l.employee_id = v_leave.employee_id
        and l.leave_type = 'annual'
        and l.status = 'approved'
        and extract(year from l.start_date) = extract(year from v_leave.start_date);

      v_available := v_allocation - v_pending - v_approved;
      if v_leave.requested_days > v_available and not p_override_insufficient_balance then
        raise exception 'LEAVE_INSUFFICIENT_BALANCE';
      end if;
    end if;
  end if;

  update leaves
  set
    status = p_decision,
    decided_by_user_id = p_actor_user_id,
    decided_at = clock_timestamp(),
    decision_note = nullif(trim(coalesce(p_decision_note, '')), ''),
    override_insufficient_balance = case when p_decision = 'approved' then p_override_insufficient_balance else false end,
    override_reason = case when p_decision = 'approved' and p_override_insufficient_balance then nullif(trim(coalesce(p_override_reason, '')), '') else null end
  where tenant_id = p_tenant_id
    and id = p_leave_id
  returning * into v_leave;

  if v_leave.approval_automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_leave.approval_automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'leave.decision', 'decision', p_decision)
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (
    p_tenant_id,
    p_actor_user_id,
    case when p_decision = 'approved' then 'leave.approved' else 'leave.rejected' end,
    p_leave_id
  );

  return v_leave;
end;
$$;

create or replace function teamframe_withdraw_leave(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_leave_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text default null
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
begin
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  update leaves
  set
    status = 'cancelled',
    cancelled_by_user_id = p_actor_user_id,
    cancelled_at = clock_timestamp(),
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where tenant_id = p_tenant_id
    and id = p_leave_id
    and employee_id = p_employee_id
    and status = 'pending'
    and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
  returning * into v_leave;

  if not found then
    return null;
  end if;

  if v_leave.approval_automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_leave.approval_automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'leave.withdrawn')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'leave.withdrawn', p_leave_id);

  return v_leave;
end;
$$;

create or replace function teamframe_cancel_approved_leave(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_leave_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text default null
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
begin
  if p_reason is not null and char_length(p_reason) > 500 then
    raise exception 'INVALID_INPUT';
  end if;

  update leaves
  set
    status = 'cancelled',
    cancelled_by_user_id = p_actor_user_id,
    cancelled_at = clock_timestamp(),
    cancellation_reason = nullif(trim(coalesce(p_reason, '')), '')
  where tenant_id = p_tenant_id
    and id = p_leave_id
    and status = 'approved'
    and teamframe_timestamp_matches(updated_at, p_expected_updated_at)
  returning * into v_leave;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'leave.cancelled', p_leave_id);

  return v_leave;
end;
$$;

create or replace function teamframe_create_position(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_title text,
  p_department text,
  p_parent_position_id uuid,
  p_assigned_employee_id uuid,
  p_note text
)
returns positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position positions;
begin
  insert into positions (
    tenant_id,
    title,
    department,
    parent_position_id,
    assigned_employee_id,
    note
  )
  values (
    p_tenant_id,
    p_title,
    p_department,
    p_parent_position_id,
    p_assigned_employee_id,
    nullif(p_note, '')
  )
  returning * into v_position;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'position.created', v_position.id);

  if p_parent_position_id is not null then
    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'position.reporting_changed', v_position.id);
  end if;

  if p_assigned_employee_id is not null then
    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'position.employee_assigned', v_position.id);
  end if;

  return v_position;
end;
$$;

create or replace function teamframe_update_position(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_position_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_department text,
  p_parent_position_id uuid,
  p_assigned_employee_id uuid,
  p_note text
)
returns positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before positions;
  v_position positions;
begin
  select *
  into v_before
  from positions
  where tenant_id = p_tenant_id
    and id = p_position_id
    and deleted_at is null
  for update;

  if not found then
    return null;
  end if;

  if v_before.updated_at <> p_expected_updated_at then
    return null;
  end if;

  update positions
  set
    title = p_title,
    department = p_department,
    parent_position_id = p_parent_position_id,
    assigned_employee_id = p_assigned_employee_id,
    note = nullif(p_note, '')
  where tenant_id = p_tenant_id
    and id = p_position_id
    and deleted_at is null
  returning * into v_position;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'position.updated', p_position_id);

  if v_before.parent_position_id is distinct from p_parent_position_id then
    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'position.reporting_changed', p_position_id);
  end if;

  if v_before.assigned_employee_id is distinct from p_assigned_employee_id then
    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (
      p_tenant_id,
      p_actor_user_id,
      case when p_assigned_employee_id is null then 'position.vacated' else 'position.employee_assigned' end,
      p_position_id
    );
  end if;

  return v_position;
end;
$$;

create or replace function teamframe_delete_position(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_position_id uuid,
  p_expected_updated_at timestamptz
)
returns positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position positions;
begin
  update positions
  set deleted_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_position_id
    and assigned_employee_id is null
    and jd_storage_path is null
    and updated_at = p_expected_updated_at
    and deleted_at is null
    and not exists (
      select 1
      from positions child
      where child.tenant_id = p_tenant_id
        and child.parent_position_id = p_position_id
        and child.deleted_at is null
    )
  returning * into v_position;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'position.deleted', p_position_id);

  return v_position;
end;
$$;

revoke all on function teamframe_create_employee(
  uuid, uuid, text, text, text, text, text, employment_type, text, date, date, uuid, text, employee_status, employee_setup_status
) from public, anon, authenticated;
revoke all on function teamframe_derive_employee_lifecycle(
  employee_status, employee_setup_status, date, date, employee_lifecycle_state
) from public, anon, authenticated;
revoke all on function teamframe_timestamp_matches(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function teamframe_complete_company_setup(uuid, uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function teamframe_complete_guided_company_setup(
  uuid, uuid, text, text, text, integer, integer, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function teamframe_update_employee(uuid, uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function teamframe_archive_employee(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function teamframe_calculate_leave_days(date, date) from public, anon, authenticated;
revoke all on function teamframe_submit_leave(uuid, uuid, uuid, date, date, leave_type, text) from public, anon, authenticated;
revoke all on function teamframe_decide_leave(uuid, uuid, uuid, leave_status, timestamptz, boolean, text, text) from public, anon, authenticated;
revoke all on function teamframe_withdraw_leave(uuid, uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function teamframe_cancel_approved_leave(uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function teamframe_create_position(uuid, uuid, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function teamframe_update_position(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function teamframe_delete_position(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;

grant execute on function teamframe_create_employee(
  uuid, uuid, text, text, text, text, text, employment_type, text, date, date, uuid, text, employee_status, employee_setup_status
) to service_role;
grant execute on function teamframe_derive_employee_lifecycle(
  employee_status, employee_setup_status, date, date, employee_lifecycle_state
) to service_role;
grant execute on function teamframe_timestamp_matches(timestamptz, timestamptz) to service_role;
grant execute on function teamframe_complete_company_setup(uuid, uuid, text, text, text, integer, integer) to service_role;
grant execute on function teamframe_complete_guided_company_setup(
  uuid, uuid, text, text, text, integer, integer, jsonb, jsonb
) to service_role;
grant execute on function teamframe_update_employee(uuid, uuid, uuid, timestamptz, jsonb) to service_role;
grant execute on function teamframe_archive_employee(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function teamframe_calculate_leave_days(date, date) to service_role;
grant execute on function teamframe_submit_leave(uuid, uuid, uuid, date, date, leave_type, text) to service_role;
grant execute on function teamframe_decide_leave(uuid, uuid, uuid, leave_status, timestamptz, boolean, text, text) to service_role;
grant execute on function teamframe_withdraw_leave(uuid, uuid, uuid, uuid, timestamptz, text) to service_role;
grant execute on function teamframe_cancel_approved_leave(uuid, uuid, uuid, timestamptz, text) to service_role;
grant execute on function teamframe_create_position(uuid, uuid, text, text, uuid, uuid, text) to service_role;
grant execute on function teamframe_update_position(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, text) to service_role;
grant execute on function teamframe_delete_position(uuid, uuid, uuid, timestamptz) to service_role;
