-- TeamFrame — company-controlled Departments reference list (Phase 1 config foundation).
--
-- ADDITIVE. The existing free-text employees.department / positions.department
-- columns are left UNCHANGED. This file only introduces the company-managed list
-- and its tenant-scoped RLS. Adoption (validate-against-list, and any optional FK)
-- is deferred to later phases so no existing data is migrated or invalidated here.

create extension if not exists "pgcrypto";

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120)
);

alter table departments add column if not exists tenant_id uuid;
alter table departments add column if not exists name text;
alter table departments add column if not exists active boolean not null default true;
alter table departments add column if not exists created_at timestamptz not null default now();
alter table departments add column if not exists updated_at timestamptz not null default now();

-- One department name per tenant (case-insensitive); reusable across the app.
create unique index if not exists departments_tenant_name_unique
  on departments (tenant_id, lower(name));
create index if not exists departments_tenant_active_idx on departments (tenant_id, active);

create or replace function departments_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists departments_set_updated_at on departments;
create trigger departments_set_updated_at
before update on departments
for each row
execute function departments_touch_updated_at();

-- Tenant isolation. Helper functions (current_actor_tenant_id / is_current_actor_admin)
-- are defined in tenancy_rls.sql / tenancy_rls_v2.sql, applied earlier in SCHEMA_ORDER.
alter table departments enable row level security;

drop policy if exists departments_select on departments;
create policy departments_select on departments
for select
using (tenant_id = current_actor_tenant_id());

drop policy if exists departments_write_admin on departments;
create policy departments_write_admin on departments
for all
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id())
with check (is_current_actor_admin() and tenant_id = current_actor_tenant_id());
