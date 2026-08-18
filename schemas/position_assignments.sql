-- TeamFrame — Phase 2: position-centric occupancy truth (effective-dated).
--
-- Answers "who occupied this position, and between what dates?" without the lossy
-- overwrite of positions.assigned_employee_id. This file applies LAST in
-- SCHEMA_ORDER so it can reference departments, work_locations, positions and
-- employees (all created earlier).
--
-- Relationship to employment_changes: employment_changes stays the EMPLOYEE-centric
-- effective change/audit log; position_assignments is the POSITION-centric occupancy
-- record. The assign/vacate functions below keep positions.assigned_employee_id (the
-- current-state pointer) and this history consistent in one atomic statement.
--
-- effective_end semantics: EXCLUSIVE — it is the handover/vacancy date (the last day
-- worked is effective_end - 1). effective_end IS NULL = the open/current assignment.
-- is_snapshot = true marks a migration row whose true start is unknown; effective_start
-- is left NULL and must never be rendered as a real historical date.

create extension if not exists "pgcrypto";

-- Composite unique keys required by the positions FKs below (Phase-1 tables have a
-- single-column PK; the tenant-composite FK needs a (tenant_id, id) unique key).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'departments_tenant_id_id_key' and conrelid = 'departments'::regclass) then
    alter table departments add constraint departments_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'work_locations_tenant_id_id_key' and conrelid = 'work_locations'::regclass) then
    alter table work_locations add constraint work_locations_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

-- Tenant-composite FKs from positions to the Phase-1 configured lists (nullable,
-- ON DELETE SET NULL so removing a list entry never deletes positions).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'positions_tenant_department_fk' and conrelid = 'positions'::regclass) then
    alter table positions add constraint positions_tenant_department_fk
      foreign key (tenant_id, department_id) references departments(tenant_id, id) on delete set null;
  end if;
exception when duplicate_object then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'positions_tenant_work_location_fk' and conrelid = 'positions'::regclass) then
    alter table positions add constraint positions_tenant_work_location_fk
      foreign key (tenant_id, work_location_id) references work_locations(tenant_id, id) on delete set null;
  end if;
exception when duplicate_object then null; end $$;

create table if not exists position_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  position_id uuid not null,
  employee_id uuid not null,
  effective_start date,
  effective_end date,
  is_snapshot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_user_id uuid,
  constraint position_assignments_tenant_position_fk
    foreign key (tenant_id, position_id) references positions(tenant_id, id) on delete cascade,
  constraint position_assignments_tenant_employee_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade,
  check (effective_end is null or effective_start is null or effective_end >= effective_start)
);

alter table position_assignments add column if not exists tenant_id uuid;
alter table position_assignments add column if not exists position_id uuid;
alter table position_assignments add column if not exists employee_id uuid;
alter table position_assignments add column if not exists effective_start date;
alter table position_assignments add column if not exists effective_end date;
alter table position_assignments add column if not exists is_snapshot boolean not null default false;
alter table position_assignments add column if not exists created_at timestamptz not null default now();
alter table position_assignments add column if not exists updated_at timestamptz not null default now();
alter table position_assignments add column if not exists created_by_user_id uuid;

-- Integrity: at most ONE open (effective_end is null) assignment per position, and at
-- most ONE open assignment per employee — mirroring the existing single-active-assignment
-- invariant on positions. This prevents two active occupants of one position and one
-- employee occupying two active positions.
create unique index if not exists position_assignments_one_open_per_position
  on position_assignments (tenant_id, position_id) where effective_end is null;
create unique index if not exists position_assignments_one_open_per_employee
  on position_assignments (tenant_id, employee_id) where effective_end is null;
create index if not exists position_assignments_position_idx on position_assignments (tenant_id, position_id, effective_start);
create index if not exists position_assignments_employee_idx on position_assignments (tenant_id, employee_id, effective_start);

create or replace function position_assignments_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists position_assignments_set_updated_at on position_assignments;
create trigger position_assignments_set_updated_at
before update on position_assignments
for each row execute function position_assignments_touch_updated_at();

-- ── Migration snapshot: DO NOT invent historical dates ──────────────────────────
-- For every position currently filled (assigned_employee_id set, not deleted) that
-- has no open assignment yet, create ONE open snapshot row with effective_start NULL
-- and is_snapshot = true. The true occupancy start is unknown and is never fabricated.
insert into position_assignments (tenant_id, position_id, employee_id, effective_start, effective_end, is_snapshot)
select p.tenant_id, p.id, p.assigned_employee_id, null, null, true
from positions p
where p.assigned_employee_id is not null
  and p.deleted_at is null
  and not exists (
    select 1 from position_assignments a
    where a.tenant_id = p.tenant_id and a.position_id = p.id and a.effective_end is null
  );

-- ── Transactional assignment / vacancy (single atomic statement each) ───────────
-- Assign an employee to a position: end the position's current open assignment and
-- the employee's current open assignment (on any other position, clearing that
-- position's pointer), then insert a new open row and update the current-state
-- pointer. Idempotent if the employee already holds this position.
create or replace function teamframe_assign_position_occupant(
  p_tenant uuid,
  p_position uuid,
  p_employee uuid,
  p_effective_start date default current_date,
  p_actor uuid default null
) returns void
language plpgsql
as $$
declare
  v_start date := coalesce(p_effective_start, current_date);
  v_other_position uuid;
begin
  if not exists (select 1 from positions where tenant_id = p_tenant and id = p_position and deleted_at is null) then
    raise exception 'POSITION_NOT_FOUND';
  end if;
  if not exists (select 1 from employees where tenant_id = p_tenant and id = p_employee and deleted_at is null) then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  -- Already the open occupant of this position → no-op (idempotent).
  if exists (
    select 1 from position_assignments
    where tenant_id = p_tenant and position_id = p_position and employee_id = p_employee and effective_end is null
  ) then
    return;
  end if;

  -- Close this position's current open assignment (different employee).
  update position_assignments
  set effective_end = v_start
  where tenant_id = p_tenant and position_id = p_position and effective_end is null;

  -- Close the employee's current open assignment on any OTHER position, and clear
  -- that position's current pointer (one active position per employee).
  select position_id into v_other_position
  from position_assignments
  where tenant_id = p_tenant and employee_id = p_employee and effective_end is null
  limit 1;
  if v_other_position is not null then
    update position_assignments
    set effective_end = v_start
    where tenant_id = p_tenant and employee_id = p_employee and effective_end is null;
    update positions set assigned_employee_id = null
    where tenant_id = p_tenant and id = v_other_position;
  end if;

  insert into position_assignments (tenant_id, position_id, employee_id, effective_start, effective_end, is_snapshot, created_by_user_id)
  values (p_tenant, p_position, p_employee, v_start, null, false, p_actor);

  update positions set assigned_employee_id = p_employee
  where tenant_id = p_tenant and id = p_position;
end;
$$;

-- Vacate a position: end its open assignment and clear the current pointer.
create or replace function teamframe_vacate_position(
  p_tenant uuid,
  p_position uuid,
  p_effective_end date default current_date
) returns void
language plpgsql
as $$
begin
  update position_assignments
  set effective_end = coalesce(p_effective_end, current_date)
  where tenant_id = p_tenant and position_id = p_position and effective_end is null;

  update positions set assigned_employee_id = null
  where tenant_id = p_tenant and id = p_position;
end;
$$;

-- ── RLS: admin-read; direct writes blocked (mutations go through the functions
-- above via the service-role path, matching employment_changes). ────────────────
alter table position_assignments enable row level security;

drop policy if exists position_assignments_select_admin on position_assignments;
create policy position_assignments_select_admin on position_assignments
for select
using (is_current_actor_admin() and tenant_id = current_actor_tenant_id());

drop policy if exists position_assignments_insert_blocked on position_assignments;
create policy position_assignments_insert_blocked on position_assignments
for insert with check (false);

drop policy if exists position_assignments_update_blocked on position_assignments;
create policy position_assignments_update_blocked on position_assignments
for update using (false) with check (false);

drop policy if exists position_assignments_delete_blocked on position_assignments;
create policy position_assignments_delete_blocked on position_assignments
for delete using (false);
