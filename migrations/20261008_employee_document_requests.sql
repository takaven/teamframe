-- Existing-install migration for employee-to-company document requests.
-- Additive only: existing documents and evidence requirements are untouched.

begin;

create type employee_document_request_type as enum (
  'salary_certificate', 'salary_transfer_letter', 'noc',
  'employment_certificate', 'experience_letter', 'other'
);

create type employee_document_request_status as enum ('requested', 'in_progress', 'ready');

create table employee_document_requests (
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
  constraint employee_document_requests_tenant_id_id_key unique (tenant_id, id),
  constraint employee_document_requests_employee_same_tenant_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade,
  constraint employee_document_requests_document_same_tenant_fk
    foreign key (tenant_id, final_document_id) references documents(tenant_id, id) on delete restrict,
  constraint employee_document_requests_automation_same_tenant_fk
    foreign key (tenant_id, automation_item_id)
    references hr_automation_items(tenant_id, id) on delete set null (automation_item_id),
  check (details is null or char_length(trim(details)) between 1 and 1000),
  check (request_type <> 'other' or char_length(trim(coalesce(details, ''))) >= 3),
  check (
    (status = 'ready' and final_document_id is not null and completed_by_user_id is not null and completed_at is not null)
    or
    (status in ('requested', 'in_progress') and final_document_id is null and completed_by_user_id is null and completed_at is null)
  )
);

create index employee_document_requests_tenant_status_idx
  on employee_document_requests(tenant_id, status, needed_by, requested_at);
create index employee_document_requests_employee_idx
  on employee_document_requests(tenant_id, employee_id, requested_at desc);
create index employee_document_requests_document_idx
  on employee_document_requests(tenant_id, final_document_id)
  where final_document_id is not null;

create function employee_document_requests_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger employee_document_requests_set_updated_at
before update on employee_document_requests
for each row execute function employee_document_requests_touch_updated_at();

create function teamframe_create_employee_document_request(
  p_id uuid,
  p_tenant_id uuid,
  p_employee_id uuid,
  p_request_type employee_document_request_type,
  p_details text,
  p_needed_by date,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql security definer set search_path = public
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
  ) returning * into v_request;

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
      jsonb_build_object('employee_id', p_employee_id, 'request_type', p_request_type, 'needed_by', p_needed_by),
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

create function teamframe_mark_employee_document_request_in_progress(
  p_tenant_id uuid,
  p_request_id uuid,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql security definer set search_path = public
as $$
declare v_request employee_document_requests;
begin
  select * into v_request from employee_document_requests
  where tenant_id = p_tenant_id and id = p_request_id for update;
  if v_request.id is null then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_NOT_FOUND'; end if;
  if v_request.status = 'ready' then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY'; end if;
  if v_request.status = 'requested' then
    update employee_document_requests set status = 'in_progress'
    where tenant_id = p_tenant_id and id = p_request_id returning * into v_request;
    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, p_actor_user_id, 'employee_document_request.in_progress', p_request_id);
  end if;
  return v_request;
end;
$$;

create function teamframe_complete_employee_document_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_document_id uuid,
  p_actor_user_id uuid
)
returns employee_document_requests
language plpgsql security definer set search_path = public
as $$
declare v_request employee_document_requests;
begin
  select * into v_request from employee_document_requests
  where tenant_id = p_tenant_id and id = p_request_id for update;
  if v_request.id is null then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_NOT_FOUND'; end if;
  if v_request.status = 'ready' then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY'; end if;
  if not exists (
    select 1 from documents
    where tenant_id = p_tenant_id
      and id = p_document_id
      and employee_id = v_request.employee_id
      and document_type = 'hr_issued_' || v_request.request_type::text
      and deleted_at is null
  ) then raise exception 'EMPLOYEE_DOCUMENT_REQUEST_DOCUMENT_INVALID'; end if;

  update employee_document_requests
  set status = 'ready', final_document_id = p_document_id,
      completed_by_user_id = p_actor_user_id, completed_at = clock_timestamp()
  where tenant_id = p_tenant_id and id = p_request_id returning * into v_request;

  if v_request.automation_item_id is not null then
    perform teamframe_run_hr_automation_item(
      p_tenant_id, v_request.automation_item_id, clock_timestamp(), true, false,
      null, null, null, jsonb_build_object('source', 'employee_document_request.ready')
    );
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'employee_document_request.ready', p_request_id);
  return v_request;
end;
$$;

alter table employee_document_requests enable row level security;

create policy employee_document_requests_select on employee_document_requests
for select using (
  tenant_id = current_actor_tenant_id()
  and (
    current_actor_employee_id(tenant_id) = employee_id
    or (
      exists (
        select 1
        from tenant_memberships tm
        where tm.auth_user_id = auth.uid()
          and tm.tenant_id = employee_document_requests.tenant_id
          and tm.active
          and tm.removed_at is null
          and coalesce(tm.people_access_scope::text, case when tm.profile in ('admin', 'full_access') then 'all' else 'none' end) <> 'none'
          and teamframe_scope_matches(
            coalesce(tm.people_access_scope::text, case when tm.profile in ('admin', 'full_access') then 'all' else 'none' end),
            tm.people_selected_employee_ids,
            tm.tenant_id,
            tm.employee_id,
            employee_document_requests.employee_id
          )
      )
      and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
    )
  )
);
create policy employee_document_requests_insert_blocked on employee_document_requests for insert with check (false);
create policy employee_document_requests_update_blocked on employee_document_requests for update using (false) with check (false);
create policy employee_document_requests_delete_blocked on employee_document_requests for delete using (false);

revoke all privileges on table employee_document_requests from public, anon, authenticated;
grant select, insert, update, delete on table employee_document_requests to service_role;
revoke all on function teamframe_create_employee_document_request(uuid, uuid, uuid, employee_document_request_type, text, date, uuid) from public, anon, authenticated;
revoke all on function teamframe_mark_employee_document_request_in_progress(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function teamframe_complete_employee_document_request(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_create_employee_document_request(uuid, uuid, uuid, employee_document_request_type, text, date, uuid) to service_role;
grant execute on function teamframe_mark_employee_document_request_in_progress(uuid, uuid, uuid) to service_role;
grant execute on function teamframe_complete_employee_document_request(uuid, uuid, uuid, uuid) to service_role;

commit;
