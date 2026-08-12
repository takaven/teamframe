-- TeamFrame MR-5 — document requirements and evidence receipt.
-- This is workflow state for configured evidence receipt only. It does not
-- validate legal/content correctness and does not create a compliance engine.

do $$ begin
  create type document_requirement_state as enum (
    'requested',
    'received',
    'accepted',
    'rejected',
    'expired',
    'replaced',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists document_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete cascade,
  document_type text not null check (char_length(trim(document_type)) between 1 and 80),
  due_date date,
  expiry_required boolean not null default false,
  review_required boolean not null default false,
  employee_upload_allowed boolean not null default true,
  state document_requirement_state not null default 'requested',
  current_document_id uuid,
  requested_at timestamptz not null default now(),
  requested_by_user_id uuid not null,
  received_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid,
  satisfied_at timestamptz,
  replaced_by_requirement_id uuid,
  automation_item_id uuid,
  expiry_automation_item_id uuid,
  review_automation_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state in ('received', 'accepted', 'expired', 'replaced') and current_document_id is not null)
    or (state in ('requested', 'rejected', 'cancelled'))
  ),
  check (
    (state = 'accepted' and satisfied_at is not null)
    or state <> 'accepted'
  )
);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_requirements_employee_same_tenant_fk'
      and conrelid = 'document_requirements'::regclass
  ) then
    alter table document_requirements
      add constraint document_requirements_employee_same_tenant_fk
        foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_requirements_document_same_tenant_fk'
      and conrelid = 'document_requirements'::regclass
  ) then
    alter table document_requirements
      add constraint document_requirements_document_same_tenant_fk
        foreign key (tenant_id, current_document_id) references documents(tenant_id, id) on delete set null;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_requirements_replacement_fk'
      and conrelid = 'document_requirements'::regclass
  ) then
    alter table document_requirements
      add constraint document_requirements_replacement_fk
        foreign key (replaced_by_requirement_id) references document_requirements(id) on delete set null;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_requirements_automation_fk'
      and conrelid = 'document_requirements'::regclass
  ) then
    alter table document_requirements
      add constraint document_requirements_automation_fk
        foreign key (tenant_id, automation_item_id) references hr_automation_items(tenant_id, id) on delete set null;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create index if not exists document_requirements_tenant_state_idx on document_requirements(tenant_id, state, due_date);
create index if not exists document_requirements_employee_idx on document_requirements(tenant_id, employee_id, state);
create index if not exists document_requirements_document_idx on document_requirements(tenant_id, current_document_id);
create unique index if not exists document_requirements_open_unique_idx
  on document_requirements(tenant_id, employee_id, document_type)
  where state in ('requested', 'received', 'rejected', 'expired');

create or replace function document_requirements_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists document_requirements_set_updated_at on document_requirements;
create trigger document_requirements_set_updated_at
before update on document_requirements
for each row
execute function document_requirements_touch_updated_at();

create or replace function teamframe_maybe_activate_employee_setup(
  p_tenant_id uuid,
  p_employee_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update employees
  set setup_status = 'active',
      lifecycle_state = 'active',
      updated_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_employee_id
    and deleted_at is null
    and status not in ('inactive')
    and lifecycle_state not in ('offboarding', 'exited')
    and setup_status <> 'active'
    and not exists (
      select 1
      from onboarding_tasks t
      where t.tenant_id = p_tenant_id
        and t.employee_id = p_employee_id
        and t.status = 'pending'
    );

  get diagnostics v_updated = row_count;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  select p_tenant_id, '00000000-0000-0000-0000-000000000000', 'system', 'onboarding.employee_activated', p_employee_id
  where v_updated > 0;

  return v_updated > 0;
end;
$$;

create or replace function teamframe_sync_document_evidence_tasks(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_document_type text,
  p_actor_user_id uuid,
  p_source text default 'document_requirement'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
begin
  update onboarding_tasks
  set status = 'completed',
      completed_at = coalesce(completed_at, clock_timestamp())
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id
    and status = 'pending'
    and completion_mode = 'document_required'
    and lower(coalesce(required_document_type, '')) = lower(p_document_type);

  get diagnostics v_closed = row_count;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  select p_tenant_id, '00000000-0000-0000-0000-000000000000', 'system', 'onboarding.document_evidence_completed', p_employee_id
  where v_closed > 0;

  perform teamframe_maybe_activate_employee_setup(p_tenant_id, p_employee_id)
  where v_closed > 0;

  return v_closed;
end;
$$;

create or replace function teamframe_sync_policy_acknowledgement_tasks(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_policy_id uuid,
  p_policy_version integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
begin
  update onboarding_tasks
  set status = 'completed',
      completed_at = coalesce(completed_at, clock_timestamp())
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id
    and status = 'pending'
    and completion_mode = 'policy_acknowledgement'
    and required_policy_id = p_policy_id
    and required_policy_version = p_policy_version;

  get diagnostics v_closed = row_count;

  insert into audit_logs (tenant_id, actor_user_id, actor_type, action_type, target_id)
  select p_tenant_id, '00000000-0000-0000-0000-000000000000', 'system', 'onboarding.policy_ack_evidence_completed', p_employee_id
  where v_closed > 0;

  perform teamframe_maybe_activate_employee_setup(p_tenant_id, p_employee_id)
  where v_closed > 0;

  return v_closed;
end;
$$;

create or replace function document_requirements_sync_evidence_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'accepted'
    and (tg_op = 'INSERT' or old.state is distinct from new.state or old.current_document_id is distinct from new.current_document_id)
  then
    perform teamframe_sync_document_evidence_tasks(
      new.tenant_id,
      new.employee_id,
      new.document_type,
      coalesce(new.reviewed_by_user_id, new.requested_by_user_id),
      'document_requirement.accepted'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists document_requirements_sync_evidence on document_requirements;
create trigger document_requirements_sync_evidence
after insert or update on document_requirements
for each row
execute function document_requirements_sync_evidence_trigger();

create or replace function acknowledgements_sync_policy_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform teamframe_sync_policy_acknowledgement_tasks(
    new.tenant_id,
    new.employee_id,
    new.policy_id,
    new.policy_version
  );
  return new;
end;
$$;

drop trigger if exists acknowledgements_sync_policy_tasks on acknowledgements;
create trigger acknowledgements_sync_policy_tasks
after insert on acknowledgements
for each row
execute function acknowledgements_sync_policy_tasks_trigger();

revoke all on function teamframe_maybe_activate_employee_setup(uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_maybe_activate_employee_setup(uuid, uuid) to service_role;

revoke all on function teamframe_sync_document_evidence_tasks(uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function teamframe_sync_document_evidence_tasks(uuid, uuid, text, uuid, text) to service_role;

revoke all on function teamframe_sync_policy_acknowledgement_tasks(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function teamframe_sync_policy_acknowledgement_tasks(uuid, uuid, uuid, integer) to service_role;
