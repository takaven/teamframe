-- TeamFrame hardening — transactional database mutations with audit evidence.

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
    p_setup_status
  )
  returning * into v_employee;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.created', v_employee.id);

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
begin
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
    lifecycle_state = case when p_patch ? 'lifecycle_state' then (p_patch ->> 'lifecycle_state')::employee_lifecycle_state else lifecycle_state end,
    setup_status = case when p_patch ? 'setup_status' then (p_patch ->> 'setup_status')::employee_setup_status else setup_status end
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and updated_at = p_expected_updated_at
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
begin
  update employees
  set
    deleted_at = clock_timestamp(),
    lifecycle_state = 'exited'
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and updated_at = p_expected_updated_at
    and deleted_at is null
  returning * into v_employee;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.archived', p_employee_id);

  return v_employee;
end;
$$;

create or replace function teamframe_submit_leave(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
begin
  insert into leaves (tenant_id, employee_id, start_date, end_date, status)
  values (p_tenant_id, p_employee_id, p_start_date, p_end_date, 'pending')
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
  p_expected_updated_at timestamptz
)
returns leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leave leaves;
begin
  update leaves
  set status = p_decision
  where tenant_id = p_tenant_id
    and id = p_leave_id
    and status = 'pending'
    and updated_at = p_expected_updated_at
  returning * into v_leave;

  if not found then
    return null;
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

revoke all on function teamframe_create_employee(
  uuid, uuid, text, text, text, text, text, employment_type, text, date, date, uuid, text, employee_status, employee_setup_status
) from public, anon, authenticated;
revoke all on function teamframe_update_employee(uuid, uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function teamframe_archive_employee(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function teamframe_submit_leave(uuid, uuid, uuid, date, date) from public, anon, authenticated;
revoke all on function teamframe_decide_leave(uuid, uuid, uuid, leave_status, timestamptz) from public, anon, authenticated;

grant execute on function teamframe_create_employee(
  uuid, uuid, text, text, text, text, text, employment_type, text, date, date, uuid, text, employee_status, employee_setup_status
) to service_role;
grant execute on function teamframe_update_employee(uuid, uuid, uuid, timestamptz, jsonb) to service_role;
grant execute on function teamframe_archive_employee(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function teamframe_submit_leave(uuid, uuid, uuid, date, date) to service_role;
grant execute on function teamframe_decide_leave(uuid, uuid, uuid, leave_status, timestamptz) to service_role;
