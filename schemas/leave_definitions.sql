-- TeamFrame — configurable Leave Definitions (Phase 1 config foundation).
--
-- ADDITIVE CONFIGURATION LAYER — the existing leave engine is UNCHANGED:
--   * the `leave_type` enum ('annual','sick','unpaid','other') is NOT replaced,
--   * `leaves.leave_type`, `leave_opening_adjustments`, and
--     teamframe_calculate_leave_days() are NOT touched.
--
-- Each configurable definition maps to an underlying `system_leave_type` (the
-- existing enum) so calculation and balances remain backward-compatible, while
-- admins can add CUSTOM named types (e.g. "Maternity Leave") that route through an
-- existing system category ('other' by default). A future additive
-- leaves.leave_definition_id column (later phase) will link a request to the
-- definition it was raised under; until then this table is pure configuration and
-- does not alter any leave write path.
--
-- Coexistence example (all three live at once, engine untouched):
--   Annual Leave    -> code 'annual',    system_leave_type 'annual', working_days
--   Sick Leave      -> code 'sick',      system_leave_type 'sick',   working_days
--   Maternity Leave -> code 'maternity', system_leave_type 'other',  calendar_days (custom)

create extension if not exists "pgcrypto";

create table if not exists leave_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  code text not null,                                       -- stable per-tenant slug; system types reuse the enum value
  display_name text not null,
  system_leave_type leave_type not null default 'other',    -- underlying calculation category (existing enum)
  active boolean not null default true,
  default_entitlement_days numeric(6,2),                    -- nullable: not every type carries an entitlement
  counting_basis text not null default 'working_days',
  attachment_requirement text not null default 'not_required',
  is_system boolean not null default false,                 -- built-in default (annual/sick/unpaid/other)
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (char_length(code) between 1 and 60),
  check (char_length(display_name) between 1 and 80),
  check (counting_basis in ('working_days', 'calendar_days')),
  check (attachment_requirement in ('not_required', 'optional', 'required')),
  check (default_entitlement_days is null or default_entitlement_days between 0 and 365),
  constraint leave_definitions_tenant_code_unique unique (tenant_id, code)
);

alter table leave_definitions add column if not exists tenant_id uuid;
alter table leave_definitions add column if not exists code text;
alter table leave_definitions add column if not exists display_name text;
alter table leave_definitions add column if not exists system_leave_type leave_type not null default 'other';
alter table leave_definitions add column if not exists active boolean not null default true;
alter table leave_definitions add column if not exists default_entitlement_days numeric(6,2);
alter table leave_definitions add column if not exists counting_basis text not null default 'working_days';
alter table leave_definitions add column if not exists attachment_requirement text not null default 'not_required';
alter table leave_definitions add column if not exists is_system boolean not null default false;
alter table leave_definitions add column if not exists sort_order integer not null default 100;
alter table leave_definitions add column if not exists created_at timestamptz not null default now();
alter table leave_definitions add column if not exists updated_at timestamptz not null default now();
alter table leave_definitions add column if not exists archived_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leave_definitions_tenant_code_unique'
      and conrelid = 'leave_definitions'::regclass
  ) then
    alter table leave_definitions
      add constraint leave_definitions_tenant_code_unique unique (tenant_id, code);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create index if not exists leave_definitions_tenant_active_idx
  on leave_definitions (tenant_id, active, sort_order);

create or replace function leave_definitions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists leave_definitions_set_updated_at on leave_definitions;
create trigger leave_definitions_set_updated_at
before update on leave_definitions
for each row
execute function leave_definitions_touch_updated_at();

alter table leave_definitions enable row level security;

-- Readable by any authenticated member of the tenant (drives the employee
-- leave-request dropdown in a later phase); writable by admins only.
drop policy if exists leave_definitions_select on leave_definitions;
create policy leave_definitions_select on leave_definitions
for select
using (tenant_id = current_actor_tenant_id());

drop policy if exists leave_definitions_write_admin on leave_definitions;
create policy leave_definitions_write_admin on leave_definitions
for all
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id())
with check (is_current_actor_admin() and tenant_id = current_actor_tenant_id());

-- Backward-compatible seed: every existing company gets the four system
-- definitions mirroring its current leave behaviour (defaults + enable flags read
-- from the companies table). Idempotent: ON CONFLICT DO NOTHING never disturbs a
-- customer that has already edited its definitions. Runs as the schema owner during
-- apply (RLS is bypassed by the table owner), so it seeds every tenant.
insert into leave_definitions
  (tenant_id, code, display_name, system_leave_type, active, default_entitlement_days, counting_basis, attachment_requirement, is_system, sort_order)
select c.id, 'annual', 'Annual Leave', 'annual', true, c.annual_leave_default_days, 'working_days', 'not_required', true, 10
from companies c
on conflict (tenant_id, code) do nothing;

insert into leave_definitions
  (tenant_id, code, display_name, system_leave_type, active, default_entitlement_days, counting_basis, attachment_requirement, is_system, sort_order)
select c.id, 'sick', 'Sick Leave', 'sick', true, c.sick_leave_default_days, 'working_days', 'not_required', true, 20
from companies c
on conflict (tenant_id, code) do nothing;

insert into leave_definitions
  (tenant_id, code, display_name, system_leave_type, active, default_entitlement_days, counting_basis, attachment_requirement, is_system, sort_order)
select c.id, 'unpaid', 'Unpaid Leave', 'unpaid', coalesce(c.unpaid_leave_enabled, true), null, 'working_days', 'not_required', true, 30
from companies c
on conflict (tenant_id, code) do nothing;

insert into leave_definitions
  (tenant_id, code, display_name, system_leave_type, active, default_entitlement_days, counting_basis, attachment_requirement, is_system, sort_order)
select c.id, 'other', 'Other Leave', 'other', coalesce(c.other_leave_enabled, true), null, 'working_days', 'not_required', true, 40
from companies c
on conflict (tenant_id, code) do nothing;
