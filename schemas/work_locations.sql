-- TeamFrame — company-controlled Work Locations (Phase 1 config foundation).
--
-- Each location is linked to an ISO-3166-1 alpha-2 country. ADDITIVE: the existing
-- free-text employees.work_location column is left UNCHANGED; adoption via an
-- optional work_location_id FK is deferred to a later phase. The DB enforces the
-- alpha-2 FORMAT only; full ISO-set validation lives in lib/geo/countries.ts and is
-- applied at the service/UI layer (a 249-row IN constraint would be a maintenance
-- liability and universal reference data does not belong in tenant tables).

create extension if not exists "pgcrypto";

create table if not exists work_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  name text not null,
  country char(2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(name) between 1 and 120),
  check (country ~ '^[A-Z]{2}$')
);

alter table work_locations add column if not exists tenant_id uuid;
alter table work_locations add column if not exists name text;
alter table work_locations add column if not exists country char(2);
alter table work_locations add column if not exists active boolean not null default true;
alter table work_locations add column if not exists created_at timestamptz not null default now();
alter table work_locations add column if not exists updated_at timestamptz not null default now();

-- One location name per tenant (case-insensitive); reusable across employees/positions.
create unique index if not exists work_locations_tenant_name_unique
  on work_locations (tenant_id, lower(name));
create index if not exists work_locations_tenant_active_idx on work_locations (tenant_id, active);
create index if not exists work_locations_tenant_country_idx on work_locations (tenant_id, country);

create or replace function work_locations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists work_locations_set_updated_at on work_locations;
create trigger work_locations_set_updated_at
before update on work_locations
for each row
execute function work_locations_touch_updated_at();

alter table work_locations enable row level security;

drop policy if exists work_locations_select on work_locations;
create policy work_locations_select on work_locations
for select
using (tenant_id = current_actor_tenant_id());

drop policy if exists work_locations_write_admin on work_locations;
create policy work_locations_write_admin on work_locations
for all
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id())
with check (is_current_actor_admin() and tenant_id = current_actor_tenant_id());
