-- One-way, operator-reviewed HirePass snapshot. No cross-system credentials or sync.
alter table employees add column if not exists hire_source_namespace text;
alter table employees add column if not exists hire_pass_candidate_id bigint;
alter table employees add column if not exists hire_offer_id bigint;
alter table employees add column if not exists hire_handoff_snapshot jsonb;
alter table employees add column if not exists hire_handoff_approved_by uuid;

create unique index if not exists employees_hire_source_unique
  on employees (tenant_id, hire_source_namespace, hire_pass_candidate_id)
  where hire_source_namespace is not null;
create unique index if not exists employees_hire_offer_unique
  on employees (tenant_id, hire_source_namespace, hire_offer_id)
  where hire_source_namespace is not null;

create or replace function teamframe_create_employee_from_hire(
  p_tenant_id uuid, p_actor_user_id uuid, p_snapshot jsonb
)
returns employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee employees;
  v_existing employees;
  v_namespace text := nullif(trim(p_snapshot->>'source_namespace'), '');
  v_candidate_id bigint := (p_snapshot->>'pass_candidate_id')::bigint;
  v_offer_id bigint := (p_snapshot->>'offer_id')::bigint;
begin
  if v_namespace is null or v_candidate_id is null or v_candidate_id <= 0
    or v_offer_id is null or v_offer_id <= 0
    or p_snapshot->>'candidate_status' is distinct from 'hired'
    or p_snapshot->>'offer_status' is distinct from 'accepted'
    or nullif(trim(p_snapshot->>'approval_reference'), '') is null
    or nullif(trim(p_snapshot->>'full_name'), '') is null
    or nullif(trim(p_snapshot->>'email'), '') is null
    or nullif(trim(p_snapshot->>'role_title'), '') is null
    or nullif(trim(p_snapshot->>'department'), '') is null
    or nullif(trim(p_snapshot->>'timezone'), '') is null
    or nullif(trim(p_snapshot->>'country'), '') is null
    or nullif(trim(p_snapshot->>'start_date'), '') is null then
    raise exception 'HIRE_HANDOFF_INVALID_SNAPSHOT';
  end if;

  -- Serialize retries for this exact source candidate. The unique index is a second guard.
  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text || ':' || v_namespace || ':' || v_candidate_id::text, 0
  ));
  select * into v_existing from employees
  where tenant_id = p_tenant_id
    and hire_source_namespace = v_namespace
    and hire_pass_candidate_id = v_candidate_id;
  if found then
    if v_existing.hire_handoff_snapshot <> p_snapshot
      or v_existing.hire_offer_id <> v_offer_id then
      raise exception 'HIRE_HANDOFF_CONFLICT';
    end if;
    return v_existing;
  end if;
  if exists (
    select 1 from employees
    where tenant_id = p_tenant_id
      and hire_source_namespace = v_namespace
      and hire_offer_id = v_offer_id
  ) then
    raise exception 'HIRE_HANDOFF_CONFLICT';
  end if;

  -- Nested RPC runs in this same transaction: employee, audit and join work roll back
  -- if provenance update fails. Invitation is deliberately not sent here.
  v_employee := teamframe_create_employee(
    p_tenant_id, p_actor_user_id,
    p_snapshot->>'full_name', p_snapshot->>'email',
    p_snapshot->>'role_title', p_snapshot->>'department',
    p_snapshot->>'timezone', (p_snapshot->>'employment_type')::employment_type,
    p_snapshot->>'country', (p_snapshot->>'start_date')::date,
    nullif(p_snapshot->>'end_date', '')::date,
    nullif(p_snapshot->>'manager_id', '')::uuid,
    nullif(p_snapshot->>'grade', ''), 'active'::employee_status,
    'incomplete'::employee_setup_status
  );
  update employees set
    hire_source_namespace = v_namespace,
    hire_pass_candidate_id = v_candidate_id,
    hire_offer_id = v_offer_id,
    hire_handoff_snapshot = p_snapshot,
    hire_handoff_approved_by = p_actor_user_id
  where tenant_id = p_tenant_id and id = v_employee.id
  returning * into v_employee;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee.created_from_hire', v_employee.id);
  return v_employee;
end;
$$;

revoke all on function teamframe_create_employee_from_hire(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function teamframe_create_employee_from_hire(uuid, uuid, jsonb)
  to service_role;
