-- TeamFrame — Phase 8 consolidated founder-correction pass (ADDITIVE, idempotent).
--
-- Introduces, without migrating away any existing column:
--   1. companies.logo_path          — optional company logo (storage path in the private
--                                      documents bucket, resolved to a signed URL at render).
--   2. companies.compensation_mode  — 'total' (single figure) vs 'components' (named breakdown).
--   3. Department data-integrity     — adopt existing free-text employee/position department
--                                      labels into the authoritative `departments` list and add
--                                      an optional employees.department_id FK (backfilled).
--   4. Configurable compensation     — company-managed named components, per-employee component
--                                      amounts, and an effective-dated change history. Storage
--                                      only: NO payroll runs, tax, payslips, WPS or benchmarking.
--
-- Scope lock: salary data stays admin/capability gated exactly like `compensation`; it is never
-- exposed through the org chart or any employee-facing surface.

create extension if not exists "pgcrypto";

-- 1 + 2. Company-level additions ------------------------------------------------------------
alter table companies add column if not exists logo_path text;
alter table companies add column if not exists compensation_mode text not null default 'total';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_compensation_mode_check' and conrelid = 'companies'::regclass
  ) then
    alter table companies
      add constraint companies_compensation_mode_check
      check (compensation_mode in ('total', 'components'));
  end if;
end $$;

-- 3. Department data integrity --------------------------------------------------------------
-- Adopt existing free-text labels into the authoritative list (idempotent; case-insensitive
-- unique index on departments already dedupes).
insert into departments (tenant_id, name, active)
select distinct e.tenant_id, btrim(e.department), true
from employees e
where e.department is not null and btrim(e.department) <> ''
on conflict (tenant_id, lower(name)) do nothing;

insert into departments (tenant_id, name, active)
select distinct p.tenant_id, btrim(p.department), true
from positions p
where p.department is not null and btrim(p.department) <> ''
on conflict (tenant_id, lower(name)) do nothing;

-- Optional FK on employees; free-text `department` is retained for compatibility and kept in
-- sync by the application going forward.
alter table employees add column if not exists department_id uuid;

do $$ begin
  alter table employees
    add constraint employees_department_fk
    foreign key (department_id) references departments(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists employees_department_id_idx on employees(department_id);

update employees e
set department_id = d.id
from departments d
where e.department_id is null
  and d.tenant_id = e.tenant_id
  and lower(d.name) = lower(btrim(e.department));

-- 4. Configurable compensation --------------------------------------------------------------
alter table compensation add column if not exists effective_date date;

-- Company-managed named components (e.g. Basic, Housing, Transport). Configuration only.
create table if not exists compensation_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 80)
);
create unique index if not exists compensation_components_tenant_name_unique
  on compensation_components (tenant_id, lower(name));
create index if not exists compensation_components_tenant_active_idx
  on compensation_components (tenant_id, active, sort_order);

-- Per-employee current breakdown; total is derived as the sum of these in 'components' mode.
create table if not exists compensation_component_amounts (
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete cascade,
  component_id uuid not null references compensation_components(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (employee_id, component_id)
);
create index if not exists compensation_component_amounts_tenant_idx
  on compensation_component_amounts (tenant_id);

-- Effective-dated change log. Immutable audit of what total/currency/basis applied when.
create table if not exists compensation_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete cascade,
  effective_date date not null,
  currency char(3) not null,
  pay_basis text not null default 'annual',
  mode text not null default 'total',
  total_amount numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  check (pay_basis in ('annual', 'monthly', 'hourly')),
  check (mode in ('total', 'components'))
);
create index if not exists compensation_history_employee_idx
  on compensation_history (tenant_id, employee_id, effective_date desc);

create or replace function compensation_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists compensation_components_set_updated_at on compensation_components;
create trigger compensation_components_set_updated_at
before update on compensation_components
for each row execute function compensation_touch_updated_at();

drop trigger if exists compensation_component_amounts_set_updated_at on compensation_component_amounts;
create trigger compensation_component_amounts_set_updated_at
before update on compensation_component_amounts
for each row execute function compensation_touch_updated_at();

-- RLS. Component NAMES are company configuration (readable by compensation viewers); amounts and
-- history are salary data gated exactly like `compensation`.
alter table compensation_components enable row level security;
alter table compensation_component_amounts enable row level security;
alter table compensation_history enable row level security;

drop policy if exists compensation_components_select on compensation_components;
create policy compensation_components_select on compensation_components
for select
using (
  current_actor_has_capability(tenant_id, 'compensation_view'::access_capability)
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability)
);

drop policy if exists compensation_components_write on compensation_components;
create policy compensation_components_write on compensation_components
for all
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability))
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability));

drop policy if exists compensation_component_amounts_select on compensation_component_amounts;
create policy compensation_component_amounts_select on compensation_component_amounts
for select
using (current_actor_has_capability(tenant_id, 'compensation_view'::access_capability, employee_id));

drop policy if exists compensation_component_amounts_write on compensation_component_amounts;
create policy compensation_component_amounts_write on compensation_component_amounts
for all
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id))
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

drop policy if exists compensation_history_select on compensation_history;
create policy compensation_history_select on compensation_history
for select
using (current_actor_has_capability(tenant_id, 'compensation_view'::access_capability, employee_id));

drop policy if exists compensation_history_write on compensation_history;
create policy compensation_history_write on compensation_history
for all
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id))
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));
