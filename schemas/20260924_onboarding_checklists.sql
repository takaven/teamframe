-- Group C: tenant-configurable onboarding checklist blueprints.
-- Assigned onboarding_tasks deliberately do not reference these rows: templates
-- are copied at assignment time so later edits never rewrite historical work.
create table if not exists onboarding_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create unique index if not exists onboarding_checklist_templates_name
  on onboarding_checklist_templates (tenant_id, lower(name));
create unique index if not exists onboarding_checklist_templates_one_default
  on onboarding_checklist_templates (tenant_id) where active and is_default;

create table if not exists onboarding_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  template_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  owner_role onboarding_task_owner_role not null default 'employee',
  due_offset_days integer not null default 0 check (due_offset_days between -90 and 365),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  completion_mode onboarding_completion_mode not null default 'manual_confirmation',
  required_document_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_checklist_items_template_fk
    foreign key (tenant_id, template_id)
    references onboarding_checklist_templates(tenant_id, id) on delete cascade,
  constraint onboarding_checklist_items_document_requirement
    check (completion_mode <> 'document_required' or nullif(btrim(required_document_type), '') is not null),
  unique (tenant_id, template_id, sort_order)
);

-- One immutable marker snapshots each employee/template assignment. The marker
-- prevents later template edits (rename/add/remove) being replayed on retries.
create table if not exists onboarding_checklist_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null,
  template_id uuid not null,
  template_name text not null,
  assigned_by uuid not null,
  assigned_at timestamptz not null default now(),
  constraint onboarding_checklist_assignments_employee_fk foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete restrict,
  unique (tenant_id, id),
  unique (tenant_id, employee_id)
);
alter table onboarding_tasks add column if not exists source_checklist_assignment_id uuid;
alter table onboarding_tasks add constraint onboarding_tasks_checklist_assignment_fk
  foreign key (tenant_id, source_checklist_assignment_id)
  references onboarding_checklist_assignments(tenant_id, id) on delete restrict;
drop index if exists onboarding_tasks_checklist_assignment_once;
alter table onboarding_tasks drop column if exists source_checklist_template_id;

create index if not exists onboarding_checklist_items_template
  on onboarding_checklist_template_items (tenant_id, template_id, sort_order);

create or replace function onboarding_checklists_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists onboarding_checklist_templates_updated_at on onboarding_checklist_templates;
create trigger onboarding_checklist_templates_updated_at before update on onboarding_checklist_templates
for each row execute function onboarding_checklists_touch_updated_at();
drop trigger if exists onboarding_checklist_items_updated_at on onboarding_checklist_template_items;
create trigger onboarding_checklist_items_updated_at before update on onboarding_checklist_template_items
for each row execute function onboarding_checklists_touch_updated_at();

-- One transaction changes the default, so a failed selection cannot leave a
-- tenant with an accidentally cleared default.
create or replace function teamframe_set_default_onboarding_checklist(
  p_tenant_id uuid,
  p_template_id uuid
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (
    select 1 from onboarding_checklist_templates
    where tenant_id = p_tenant_id and id = p_template_id and active
  ) then
    raise exception 'ONBOARDING_CHECKLIST_NOT_FOUND';
  end if;
  update onboarding_checklist_templates
    set is_default = (id = p_template_id)
    where tenant_id = p_tenant_id and (is_default or id = p_template_id);
end;
$$;

create or replace function teamframe_assign_default_onboarding_checklist(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_actor_user_id uuid
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_template onboarding_checklist_templates%rowtype;
  v_employee employees%rowtype;
  v_assignment_id uuid;
  v_count integer;
begin
  select * into v_template from onboarding_checklist_templates
    where tenant_id = p_tenant_id and active and is_default;
  if not found then return 0; end if;

  select * into v_employee from employees
    where tenant_id = p_tenant_id and id = p_employee_id and deleted_at is null;
  if not found then raise exception 'ONBOARDING_CHECKLIST_EMPLOYEE_NOT_FOUND'; end if;

  insert into onboarding_checklist_assignments (tenant_id, employee_id, template_id, template_name, assigned_by)
  values (p_tenant_id, p_employee_id, v_template.id, v_template.name, p_actor_user_id)
  on conflict (tenant_id, employee_id) do nothing
  returning id into v_assignment_id;
  if v_assignment_id is null then return 0; end if;

  -- Employee creation still initializes the historical five-task starter
  -- baseline before the application assigns a configurable default. Replace
  -- only those exact pending, unprovenanced starter rows so a configured
  -- checklist is the single source of onboarding work. Manual/custom tasks
  -- and any task with evidence or a checklist assignment remain untouched.
  delete from onboarding_tasks
  where tenant_id = p_tenant_id
    and employee_id = p_employee_id
    and status = 'pending'
    and source_checklist_assignment_id is null
    and title in (
      'Sign your employment contract',
      'Complete your employee profile',
      'Upload ID and right-to-work documents',
      'Read and acknowledge company policies',
      'Confirm payroll and bank details'
    );

  insert into onboarding_tasks (
    tenant_id, employee_id, title, status, owner_role, owner_employee_id,
    assigned_by, due_date, completion_mode, required_document_type,
    source_checklist_assignment_id
  )
  select p_tenant_id, p_employee_id, i.title, 'pending', i.owner_role,
    case when i.owner_role = 'manager' then v_employee.manager_id else null end,
    p_actor_user_id,
    ((coalesce(v_employee.start_date, v_employee.created_at::date) + i.due_offset_days)::date),
    i.completion_mode, i.required_document_type, v_assignment_id
  from onboarding_checklist_template_items i
  where i.tenant_id = p_tenant_id and i.template_id = v_template.id and i.active
  order by i.sort_order;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table onboarding_checklist_templates enable row level security;
alter table onboarding_checklist_template_items enable row level security;
alter table onboarding_checklist_assignments enable row level security;

drop policy if exists onboarding_checklist_templates_select on onboarding_checklist_templates;
create policy onboarding_checklist_templates_select on onboarding_checklist_templates
for select using (tenant_id = current_actor_tenant_id());
drop policy if exists onboarding_checklist_templates_write on onboarding_checklist_templates;
create policy onboarding_checklist_templates_write on onboarding_checklist_templates
for all using (current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability))
with check (current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability));

drop policy if exists onboarding_checklist_items_select on onboarding_checklist_template_items;
create policy onboarding_checklist_items_select on onboarding_checklist_template_items
for select using (tenant_id = current_actor_tenant_id());
drop policy if exists onboarding_checklist_items_write on onboarding_checklist_template_items;
create policy onboarding_checklist_items_write on onboarding_checklist_template_items
for all using (current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability))
with check (current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability));

drop policy if exists onboarding_checklist_assignments_select on onboarding_checklist_assignments;
create policy onboarding_checklist_assignments_select on onboarding_checklist_assignments
for select using (tenant_id = current_actor_tenant_id());

revoke all on function teamframe_set_default_onboarding_checklist(uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_set_default_onboarding_checklist(uuid, uuid) to service_role;
revoke all on function teamframe_assign_default_onboarding_checklist(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function teamframe_assign_default_onboarding_checklist(uuid, uuid, uuid) to service_role;
grant select, insert, update, delete on table
  onboarding_checklist_templates,
  onboarding_checklist_template_items,
  onboarding_checklist_assignments
to service_role;
