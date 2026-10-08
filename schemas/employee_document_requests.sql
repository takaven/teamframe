-- Employee-to-company document requests.
--
-- This is deliberately separate from document_requirements: those rows are
-- company-to-employee evidence requests and feed employee-file completeness.
-- Final HR-issued files still reuse the existing private documents store.

do $$ begin
  create type employee_document_request_type as enum (
    'salary_certificate',
    'salary_transfer_letter',
    'noc',
    'employment_certificate',
    'experience_letter',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_document_request_status as enum (
    'requested',
    'in_progress',
    'ready'
  );
exception when duplicate_object then null; end $$;

create table if not exists employee_document_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  request_type employee_document_request_type not null,
  details text,
  needed_by date,
  status employee_document_request_status not null default 'requested',
  final_document_id uuid,
  automation_item_id uuid,
  requested_by_user_id uuid not null,
  requested_at timestamptz not null default now(),
  completed_by_user_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (details is null or char_length(trim(details)) between 1 and 1000),
  check (request_type <> 'other' or char_length(trim(coalesce(details, ''))) >= 3),
  check (
    (status = 'ready' and final_document_id is not null and completed_by_user_id is not null and completed_at is not null)
    or
    (status in ('requested', 'in_progress') and final_document_id is null and completed_by_user_id is null and completed_at is null)
  )
);

revoke all privileges on table employee_document_requests from public, anon, authenticated;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employee_document_requests_tenant_id_id_key'
      and conrelid = 'employee_document_requests'::regclass
  ) then
    alter table employee_document_requests
      add constraint employee_document_requests_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  alter table employee_document_requests
    add constraint employee_document_requests_employee_same_tenant_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table employee_document_requests
    add constraint employee_document_requests_document_same_tenant_fk
      foreign key (tenant_id, final_document_id) references documents(tenant_id, id) on delete restrict;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table employee_document_requests
    add constraint employee_document_requests_automation_same_tenant_fk
      foreign key (tenant_id, automation_item_id)
      references hr_automation_items(tenant_id, id) on delete set null (automation_item_id);
exception when duplicate_object then null; end $$;

create index if not exists employee_document_requests_tenant_status_idx
  on employee_document_requests(tenant_id, status, needed_by, requested_at);
create index if not exists employee_document_requests_employee_idx
  on employee_document_requests(tenant_id, employee_id, requested_at desc);
create index if not exists employee_document_requests_document_idx
  on employee_document_requests(tenant_id, final_document_id)
  where final_document_id is not null;

create or replace function employee_document_requests_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists employee_document_requests_set_updated_at on employee_document_requests;
create trigger employee_document_requests_set_updated_at
before update on employee_document_requests
for each row execute function employee_document_requests_touch_updated_at();

-- Creates the request, its optional dated automation item and its audit record
-- in one database transaction. Undated requests remain visible in the Documents
-- queue without inventing an SLA for the automation substrate.
create or replace function teamframe_create_employee_document_request(
  p_id uuid,
  p_tenant_id uuid,
  p_employee_id uuid,
  p_request_type employee_document_request_type,
  p_details text,
  p_needed_by date,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request employee_document_requests;
  v_automation_item_id uuid;
  v_requested_at timestamptz := clock_timestamp();
begin
  insert into employee_document_requests (
    id, tenant_id, employee_id, request_type, details, needed_by,
    requested_by_user_id, requested_at
  ) values (
    p_id, p_tenant_id, p_employee_id, p_request_type,
    nullif(trim(p_details), ''), p_needed_by, p_actor_user_id, v_requested_at
  )
  returning * into v_request;

  if p_needed_by is not null then
    v_automation_item_id := teamframe_ensure_hr_automation_item(
      p_tenant_id,
      'employee.document_request',
      'employee_document_request:' || p_id::text,
      'employee_document_request',
      p_id,
      null,
      (p_needed_by::text || 'T09:00:00.000Z')::timestamptz,
      'decision',
      null,
      jsonb_build_object(
        'employee_id', p_employee_id,
        'request_type', p_request_type,
        'needed_by', p_needed_by
      ),
      3
    );

    update employee_document_requests
    set automation_item_id = v_automation_item_id
    where tenant_id = p_tenant_id and id = p_id
    returning * into v_request;

    update hr_automation_items
    set owner_role = 'admin'
    where tenant_id = p_tenant_id and id = v_automation_item_id;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee_document_request.created', p_id);

  return v_request;
end;
$$;

create or replace function teamframe_mark_employee_document_request_in_progress(
  p_tenant_id uuid,
  p_request_id uuid,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request employee_document_requests;
begin
  select * into v_request
  from employee_document_requests
  where tenant_id = p_tenant_id and id = p_request_id
  for update;

  if v_request.id is null then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_NOT_FOUND'; end if;
  if v_request.status = 'ready' then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY'; end if;

  if v_request.status = 'requested' then
    update employee_document_requests
    set status = 'in_progress'
    where tenant_id = p_tenant_id and id = p_request_id
    returning * into v_request;

    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'employee_document_request.in_progress', p_request_id);
  end if;

  return v_request;
end;
$$;

-- Atomically links the already-created private document, marks the request
-- ready, completes its action item and records the status history. A concurrent
-- second completion fails before it can replace the linked file.
create or replace function teamframe_complete_employee_document_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_document_id uuid,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request employee_document_requests;
begin
  select * into v_request
  from employee_document_requests
  where tenant_id = p_tenant_id and id = p_request_id
  for update;

  if v_request.id is null then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_NOT_FOUND'; end if;
  if v_request.status = 'ready' then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY'; end if;

  if not exists (
    select 1 from documents
    where tenant_id = p_tenant_id
      and id = p_document_id
      and employee_id = v_request.employee_id
      and document_type = 'hr_issued_' || v_request.request_type::text
      and deleted_at is null
  ) then
    raise exception 'EMPLOYEE_DOCUMENT_REQUEST_DOCUMENT_INVALID';
  end if;

  update employee_document_requests
  set status = 'ready',
      final_document_id = p_document_id,
      completed_by_user_id = p_actor_user_id,
      completed_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_request_id
  returning * into v_request;

  if v_request.automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id,
      v_request.automation_item_id,
      clock_timestamp(),
      true,
      false,
      null,
      null,
      null,
      jsonb_build_object('source', 'employee_document_request.ready')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee_document_request.ready', p_request_id);

  return v_request;
end;
$$;

revoke all on function teamframe_create_employee_document_request(uuid, uuid, uuid, employee_document_request_type, text, date, uuid) from public, anon, authenticated;
revoke all on function teamframe_mark_employee_document_request_in_progress(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function teamframe_complete_employee_document_request(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_create_employee_document_request(uuid, uuid, uuid, employee_document_request_type, text, date, uuid) to service_role;
grant execute on function teamframe_mark_employee_document_request_in_progress(uuid, uuid, uuid) to service_role;
grant execute on function teamframe_complete_employee_document_request(uuid, uuid, uuid, uuid) to service_role;
