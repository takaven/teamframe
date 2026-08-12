-- TeamFrame V1 — onboarding_tasks
-- Scope lock: assign + complete, with an optional per-task due date.
-- Templates are static packs in code (services/onboardingService/templates.ts);
-- there is no template table. No multi-step workflows, no reminders,
-- no notifications (Wave 2, gap audit 2026-05-30).

do $$ begin
  create type onboarding_task_status as enum ('pending', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type onboarding_completion_mode as enum (
    'manual_confirmation',
    'document_required',
    'policy_acknowledgement',
    'form_or_data_required'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type onboarding_task_owner_role as enum ('employee', 'manager', 'admin', 'system');
exception when duplicate_object then null; end $$;

create table if not exists onboarding_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid        not null references companies(id) on delete restrict,
  employee_id  uuid        not null references employees(id) on delete cascade,
  title        text        not null check (char_length(trim(title)) > 0),
  status       onboarding_task_status not null default 'pending',
  owner_role   onboarding_task_owner_role not null default 'employee',
  owner_employee_id uuid,
  assigned_by  uuid        not null,
  due_date     date,
  automation_item_id uuid,
  completion_mode onboarding_completion_mode not null default 'manual_confirmation',
  required_document_type text,
  required_policy_id uuid,
  required_policy_version integer,
  form_requirement_key text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint onboarding_completed_at_check check (
    (status = 'completed' and completed_at is not null) or
    (status = 'pending'   and completed_at is null)
  )
);

-- Wave 2 additive migration: existing deployments predate the due_date column.
alter table onboarding_tasks add column if not exists due_date date;
alter table onboarding_tasks add column if not exists owner_role onboarding_task_owner_role not null default 'employee';
alter table onboarding_tasks add column if not exists owner_employee_id uuid;
alter table onboarding_tasks add column if not exists automation_item_id uuid;
alter table onboarding_tasks add column if not exists completion_mode onboarding_completion_mode not null default 'manual_confirmation';
alter table onboarding_tasks add column if not exists required_document_type text;
alter table onboarding_tasks add column if not exists required_policy_id uuid;
alter table onboarding_tasks add column if not exists required_policy_version integer;
alter table onboarding_tasks add column if not exists form_requirement_key text;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_tasks_tenant_id_id_key'
      and conrelid = 'onboarding_tasks'::regclass
  ) then
    alter table onboarding_tasks
      add constraint onboarding_tasks_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_tasks_tenant_owner_employee_fk'
      and conrelid = 'onboarding_tasks'::regclass
  ) then
    alter table onboarding_tasks
      add constraint onboarding_tasks_tenant_owner_employee_fk
        foreign key (tenant_id, owner_employee_id)
        references employees(tenant_id, id)
        on delete set null;
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'onboarding_tasks_automation_fk'
      and conrelid = 'onboarding_tasks'::regclass
  ) then
    alter table onboarding_tasks
      add constraint onboarding_tasks_automation_fk
        foreign key (tenant_id, automation_item_id)
        references hr_automation_items(tenant_id, id)
        on delete set null;
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create index if not exists onboarding_tasks_employee_id_idx on onboarding_tasks(employee_id);
create index if not exists onboarding_tasks_tenant_id_idx   on onboarding_tasks(tenant_id);
create index if not exists onboarding_tasks_status_idx      on onboarding_tasks(status);
create index if not exists onboarding_tasks_manager_owner_idx on onboarding_tasks(tenant_id, employee_id, owner_role, status)
  where owner_role = 'manager';
create index if not exists onboarding_tasks_completion_mode_idx on onboarding_tasks(tenant_id, completion_mode, status);
create index if not exists onboarding_tasks_required_document_idx on onboarding_tasks(tenant_id, employee_id, required_document_type)
  where completion_mode = 'document_required' and status = 'pending';
create index if not exists onboarding_tasks_required_policy_idx on onboarding_tasks(tenant_id, employee_id, required_policy_id, required_policy_version)
  where completion_mode = 'policy_acknowledgement' and status = 'pending';

create or replace function onboarding_tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists onboarding_tasks_set_updated_at on onboarding_tasks;
create trigger onboarding_tasks_set_updated_at
before update on onboarding_tasks
for each row
execute function onboarding_tasks_touch_updated_at();
