-- TeamFrame V1 -- acknowledgements
-- Immutable acceptance events of a specific policy version by an employee.

create table if not exists acknowledgements (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid        not null references companies(id) on delete restrict,
  policy_id      uuid        not null references policies(id) on delete restrict,
  policy_version integer     not null,
  employee_id    uuid        not null references employees(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  check (policy_version >= 1)
);

alter table acknowledgements add column if not exists tenant_id uuid;
alter table acknowledgements add column if not exists policy_version integer not null default 1;

update acknowledgements a
set tenant_id = e.tenant_id
from employees e
where a.employee_id = e.id
  and a.tenant_id is null;

alter table acknowledgements
  alter column tenant_id set not null;

do $$ begin
  alter table acknowledgements
    add constraint acknowledgements_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acknowledgements_unique_policy_employee_version'
      and conrelid = 'acknowledgements'::regclass
  ) then
    alter table acknowledgements
      add constraint acknowledgements_unique_policy_employee_version
        unique (tenant_id, policy_id, policy_version, employee_id);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acknowledgements_policy_same_tenant_fk'
      and conrelid = 'acknowledgements'::regclass
  ) then
    alter table acknowledgements
      add constraint acknowledgements_policy_same_tenant_fk
        foreign key (tenant_id, policy_id) references policies(tenant_id, id) on delete restrict;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'acknowledgements_employee_same_tenant_fk'
      and conrelid = 'acknowledgements'::regclass
  ) then
    alter table acknowledgements
      add constraint acknowledgements_employee_same_tenant_fk
        foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete restrict;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create index if not exists acknowledgements_tenant_id_idx on acknowledgements(tenant_id);
create index if not exists acknowledgements_employee_id_idx on acknowledgements(employee_id);
create index if not exists acknowledgements_policy_id_idx on acknowledgements(policy_id);
create index if not exists acknowledgements_acknowledged_at_idx on acknowledgements(acknowledged_at desc);

create or replace function teamframe_acknowledge_policy(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_employee_id uuid,
  p_policy_id uuid,
  p_policy_version integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ack_id uuid;
begin
  if not exists (
    select 1
    from employees e
    where e.id = p_employee_id
      and e.tenant_id = p_tenant_id
      and e.deleted_at is null
  ) then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from policies p
    where p.id = p_policy_id
      and p.tenant_id = p_tenant_id
      and p.version = p_policy_version
      and p.is_published = true
      and p.archived_at is null
  ) then
    raise exception 'POLICY_NOT_ACKNOWLEDGEABLE';
  end if;

  insert into acknowledgements (tenant_id, policy_id, policy_version, employee_id)
  values (p_tenant_id, p_policy_id, p_policy_version, p_employee_id)
  on conflict on constraint acknowledgements_unique_policy_employee_version do nothing
  returning id into v_ack_id;

  if v_ack_id is null then
    select id into v_ack_id
    from acknowledgements
    where tenant_id = p_tenant_id
      and policy_id = p_policy_id
      and policy_version = p_policy_version
      and employee_id = p_employee_id;

    return v_ack_id;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'policy.acknowledged', v_ack_id);

  return v_ack_id;
end;
$$;

-- Service-role only: this security-definer function bypasses RLS, so it must not be callable by
-- end users. The service passes the actor's OWN employee id; direct authenticated access (a crafted
-- request acknowledging on another employee's or tenant's behalf) is blocked here, with the
-- acknowledgements_insert RLS policy as the second layer for any direct table write.
revoke all on function teamframe_acknowledge_policy(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function teamframe_acknowledge_policy(uuid, uuid, uuid, uuid, integer) to service_role;
