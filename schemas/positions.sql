-- TeamFrame Org Chart — bounded position and reporting structure.
-- Scope lock: positions, reporting relationships, one active employee assignment,
-- and a single private job-description attachment. No recruiting, budgeting,
-- scenario planning, dotted-line reporting, or performance management.

create extension if not exists "pgcrypto";

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  title text not null,
  department text not null,
  parent_position_id uuid,
  assigned_employee_id uuid,
  note text,
  jd_storage_bucket text,
  jd_storage_path text,
  jd_original_filename text,
  jd_mime_type text,
  jd_uploaded_at timestamptz,
  jd_uploaded_by_actor_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(title) between 1 and 160),
  check (char_length(department) between 1 and 120),
  check (note is null or char_length(note) <= 500),
  check (jd_storage_bucket is null or char_length(jd_storage_bucket) between 1 and 120),
  check (jd_storage_path is null or char_length(jd_storage_path) between 1 and 700),
  check (jd_original_filename is null or char_length(jd_original_filename) between 1 and 180),
  check (jd_mime_type is null or char_length(jd_mime_type) between 1 and 160),
  check (
    (jd_storage_path is null and jd_original_filename is null and jd_mime_type is null and jd_uploaded_at is null)
    or
    (jd_storage_bucket is not null and jd_storage_path is not null and jd_original_filename is not null and jd_mime_type is not null and jd_uploaded_at is not null)
  )
);

alter table positions add column if not exists tenant_id uuid;
alter table positions add column if not exists title text;
alter table positions add column if not exists department text;
alter table positions add column if not exists parent_position_id uuid;
alter table positions add column if not exists assigned_employee_id uuid;
alter table positions add column if not exists note text;
alter table positions add column if not exists jd_storage_bucket text;
alter table positions add column if not exists jd_storage_path text;
alter table positions add column if not exists jd_original_filename text;
alter table positions add column if not exists jd_mime_type text;
alter table positions add column if not exists jd_uploaded_at timestamptz;
alter table positions add column if not exists jd_uploaded_by_actor_user_id uuid;
alter table positions add column if not exists created_at timestamptz not null default now();
alter table positions add column if not exists updated_at timestamptz not null default now();
alter table positions add column if not exists deleted_at timestamptz;

-- Phase 2 (additive): reference the Phase-1 company-controlled lists and add a
-- budgeted flag. The existing free-text `department` column is UNCHANGED for
-- backward compatibility; `department_id` is the optional additive reference that
-- new/edited positions validate against active departments at the service layer.
-- No forced normalisation of historical free-text values. The composite FKs to
-- departments/work_locations are added later in position_assignments.sql, because
-- those tables apply after this file in SCHEMA_ORDER.
alter table positions add column if not exists department_id uuid;
alter table positions add column if not exists work_location_id uuid;
-- budgeted: null = unspecified (legacy/not yet set), true = Budgeted, false = Non-budgeted.
alter table positions add column if not exists budgeted boolean;

create index if not exists positions_department_id_idx on positions(tenant_id, department_id);
create index if not exists positions_work_location_id_idx on positions(tenant_id, work_location_id);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'positions_tenant_id_id_key'
      and conrelid = 'positions'::regclass
  ) then
    alter table positions add constraint positions_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'positions_tenant_parent_fk'
      and conrelid = 'positions'::regclass
  ) then
    alter table positions
      add constraint positions_tenant_parent_fk
      foreign key (tenant_id, parent_position_id)
      references positions(tenant_id, id)
      on delete restrict;
  end if;
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'positions_tenant_employee_fk'
      and conrelid = 'positions'::regclass
  ) then
    alter table positions
      add constraint positions_tenant_employee_fk
      foreign key (tenant_id, assigned_employee_id)
      references employees(tenant_id, id)
      on delete restrict;
  end if;
exception when duplicate_object then null; end $$;

create index if not exists positions_tenant_id_idx on positions(tenant_id);
create index if not exists positions_parent_idx on positions(tenant_id, parent_position_id);
create index if not exists positions_assigned_employee_idx on positions(tenant_id, assigned_employee_id);
create index if not exists positions_deleted_at_idx on positions(deleted_at);
create unique index if not exists positions_one_active_assignment_per_employee_idx
  on positions(tenant_id, assigned_employee_id)
  where assigned_employee_id is not null and deleted_at is null;

create or replace function positions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists positions_set_updated_at on positions;
create trigger positions_set_updated_at
before update on positions
for each row
execute function positions_touch_updated_at();

create or replace function positions_prevent_reporting_cycle()
returns trigger
language plpgsql
as $$
declare
  v_seen uuid[] := array[]::uuid[];
  v_parent uuid;
begin
  if new.parent_position_id is null then
    return new;
  end if;

  if new.parent_position_id = new.id then
    raise exception 'POSITION_SELF_REPORTING';
  end if;

  v_parent := new.parent_position_id;
  while v_parent is not null loop
    if v_parent = any(v_seen) then
      raise exception 'POSITION_REPORTING_CYCLE';
    end if;
    v_seen := array_append(v_seen, v_parent);

    if v_parent = new.id then
      raise exception 'POSITION_REPORTING_CYCLE';
    end if;

    select parent_position_id
    into v_parent
    from positions
    where tenant_id = new.tenant_id
      and id = v_parent
      and deleted_at is null;
  end loop;

  return new;
end;
$$;

drop trigger if exists positions_validate_reporting on positions;
create trigger positions_validate_reporting
before insert or update of parent_position_id, tenant_id
on positions
for each row
execute function positions_prevent_reporting_cycle();
