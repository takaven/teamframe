-- TeamFrame V1 — employees
-- Scope lock: directory record only. No payroll, no performance, no scoring.

create extension if not exists "pgcrypto";

do $$ begin
  create type employee_status as enum ('active', 'on_leave', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_setup_status as enum ('incomplete', 'ready', 'active');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum ('full_time', 'part_time', 'contractor', 'intern');
exception when duplicate_object then null; end $$;

create table if not exists employees (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid        not null references companies(id) on delete restrict,
  auth_user_id    uuid unique,
  full_name       text        not null,
  preferred_name  text,
  employee_number text,
  email           text        not null,
  personal_email text,
  mobile text,
  residential_address text,
  date_of_birth date,
  nationality text,
  gender text,
  work_location text,
  company_phone text,
  role_title      text        not null,
  department      text        not null,
  timezone        text        not null,
  manager_id      uuid        references employees(id) on delete set null,
  employment_type employment_type not null default 'full_time',
  status          employee_status        not null default 'active',
  grade           text,
  setup_status    employee_setup_status  not null default 'incomplete',
  invite_attempt_count integer not null default 0,
  invite_last_attempt_at timestamptz,
  invite_last_sent_at timestamptz,
  invite_last_error text,
  activated_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

alter table employees add column if not exists tenant_id uuid;
alter table employees add column if not exists auth_user_id uuid;
alter table employees add column if not exists preferred_name text;
alter table employees add column if not exists employee_number text;
alter table employees add column if not exists personal_email text;
alter table employees add column if not exists mobile text;
alter table employees add column if not exists residential_address text;
alter table employees add column if not exists date_of_birth date;
alter table employees add column if not exists nationality text;
alter table employees add column if not exists work_location text;
alter table employees add column if not exists updated_at timestamptz not null default now();
alter table employees add column if not exists invite_attempt_count integer not null default 0;
alter table employees add column if not exists invite_last_attempt_at timestamptz;
alter table employees add column if not exists invite_last_sent_at timestamptz;
alter table employees add column if not exists invite_last_error text;
alter table employees add column if not exists activated_at timestamptz;

update employees
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table employees
  alter column tenant_id set not null;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_tenant_fk'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_tenant_fk
        foreign key (tenant_id) references companies(id) on delete restrict;
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_auth_user_id_key'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_auth_user_id_key unique (auth_user_id);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

alter table employees drop constraint if exists employees_email_key;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_tenant_email_key'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_tenant_email_key unique (tenant_id, email);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_tenant_id_id_key'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_tenant_id_id_key unique (tenant_id, id);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create index if not exists employees_manager_id_idx on employees(manager_id);
create index if not exists employees_tenant_id_idx  on employees(tenant_id);
create index if not exists employees_auth_user_id_idx on employees(auth_user_id);
create index if not exists employees_status_idx     on employees(status);
create index if not exists employees_deleted_at_idx on employees(deleted_at);

-- FPORS pivot (Wave 1): lifecycle + jurisdiction signals
do $$ begin
  create type employee_lifecycle_state as enum ('preboarding', 'active', 'on_leave', 'offboarding', 'exited');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type employee_lifecycle_state add value if not exists 'on_leave';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type employee_lifecycle_state add value if not exists 'offboarding';
exception when duplicate_object then null; end $$;

alter table employees add column if not exists lifecycle_state employee_lifecycle_state not null default 'active';
alter table employees add column if not exists employment_type employment_type not null default 'full_time';
alter table employees add column if not exists start_date date;
alter table employees add column if not exists end_date date;
alter table employees add column if not exists country text;
alter table employees add column if not exists working_days_override smallint[];
alter table employees add column if not exists annual_leave_entitlement_override numeric(6,2);
alter table employees add column if not exists emergency_contact_name text;
alter table employees add column if not exists emergency_contact_relationship text;
alter table employees add column if not exists emergency_contact_phone text;
alter table employees add column if not exists emergency_contact_email text;
alter table employees add column if not exists gender text;
alter table employees add column if not exists company_phone text;

create index if not exists employees_lifecycle_state_idx on employees(lifecycle_state);
create index if not exists employees_employment_type_idx on employees(employment_type);
create index if not exists employees_start_date_idx on employees(start_date);
create index if not exists employees_end_date_idx on employees(end_date);
create unique index if not exists employees_tenant_employee_number_unique
  on employees(tenant_id, employee_number)
  where employee_number is not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_working_days_override_check'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_working_days_override_check
      check (
        working_days_override is null
        or (
          cardinality(working_days_override) between 1 and 7
          and working_days_override <@ array[1,2,3,4,5,6,7]::smallint[]
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_annual_leave_entitlement_override_check'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_annual_leave_entitlement_override_check
      check (annual_leave_entitlement_override is null or annual_leave_entitlement_override between 0 and 365);
  end if;
end $$;

-- Gender is optional and normalised to a small vocabulary so it can support future
-- workforce-composition reporting without free-text drift. Nullable throughout.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_gender_check'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_gender_check
      check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employees_company_phone_check'
      and conrelid = 'employees'::regclass
  ) then
    alter table employees
      add constraint employees_company_phone_check
      check (company_phone is null or char_length(company_phone) between 3 and 40);
  end if;
end $$;

create or replace function employees_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on employees;
create trigger employees_set_updated_at
before update on employees
for each row
execute function employees_touch_updated_at();

-- Forward declaration for fresh databases: the real definition lives in
-- tenancy_rls.sql / tenancy_rls_v2.sql (applied later in SCHEMA_ORDER).
-- The stub returns NULL (matches no rows) so the view below can be created
-- before the tenancy helpers are applied. `create or replace` in the tenancy
-- files overwrites it with the JWT-based implementation.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'current_actor_tenant_id'
      and n.nspname = 'public'
  ) then
    create function current_actor_tenant_id()
    returns uuid
    language sql
    stable
    as 'select null::uuid';
  end if;
end $$;

create or replace view employees_public as
select
  id,
  tenant_id,
  full_name,
  role_title,
  department,
  manager_id,
  status
from employees
where tenant_id = current_actor_tenant_id()
  and deleted_at is null;

revoke all on table employees_public from public;
grant select on table employees_public to authenticated;
grant select on table employees_public to service_role;
