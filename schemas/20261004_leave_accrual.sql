-- Marketability Release M1 — transparent leave accrual, carry-forward, adjustments, and half-days.
-- Additive and tenant-scoped. Existing leave rows and legacy opening-used adjustments remain valid.

alter table leave_definitions add column if not exists accrual_enabled boolean not null default false;
alter table leave_definitions add column if not exists accrual_frequency text not null default 'monthly';
alter table leave_definitions add column if not exists joining_date_pro_rata boolean not null default false;
alter table leave_definitions add column if not exists carry_forward_enabled boolean not null default false;
alter table leave_definitions add column if not exists carry_forward_cap_days numeric(6,2);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leave_definitions_accrual_frequency_check') then
    alter table leave_definitions add constraint leave_definitions_accrual_frequency_check
      check (accrual_frequency in ('monthly', 'annual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leave_definitions_carry_cap_check') then
    alter table leave_definitions add constraint leave_definitions_carry_cap_check
      check (carry_forward_cap_days is null or carry_forward_cap_days between 0 and 365);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leave_definitions_single_entitlement_timing_check') then
    alter table leave_definitions add constraint leave_definitions_single_entitlement_timing_check
      check (not (accrual_enabled and joining_date_pro_rata)) not valid;
  end if;
end $$;

alter table leaves add column if not exists day_part text not null default 'full_day';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leaves_day_part_check') then
    alter table leaves add constraint leaves_day_part_check
      check (day_part in ('full_day', 'morning', 'afternoon'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leaves_half_day_single_date_check') then
    alter table leaves add constraint leaves_half_day_single_date_check
      check (day_part = 'full_day' or (start_date = end_date and requested_days = 0.5));
  end if;
end $$;

create table if not exists leave_balance_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  leave_definition_id uuid not null,
  balance_year integer not null,
  entry_kind text not null,
  amount_days numeric(7,2) not null,
  effective_date date not null,
  reason text not null,
  source_year integer,
  idempotency_key text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint leave_balance_entries_employee_fk foreign key (tenant_id, employee_id)
    references employees(tenant_id, id) on delete cascade,
  constraint leave_balance_entries_definition_fk foreign key (tenant_id, leave_definition_id)
    references leave_definitions(tenant_id, id) on delete restrict,
  constraint leave_balance_entries_kind_check check (entry_kind in ('opening', 'carry_forward', 'admin_adjustment')),
  constraint leave_balance_entries_year_check check (balance_year between 2000 and 2200),
  constraint leave_balance_entries_reason_check check (char_length(trim(reason)) between 1 and 500),
  constraint leave_balance_entries_nonzero_check check (amount_days <> 0),
  constraint leave_balance_entries_source_check check (
    (entry_kind = 'carry_forward' and source_year = balance_year - 1)
    or (entry_kind <> 'carry_forward' and source_year is null)
  ),
  constraint leave_balance_entries_idempotency_unique unique (tenant_id, idempotency_key)
);

create index if not exists leave_balance_entries_lookup_idx
  on leave_balance_entries (tenant_id, employee_id, leave_definition_id, balance_year, effective_date);

alter table leave_balance_entries enable row level security;
drop policy if exists leave_balance_entries_select on leave_balance_entries;
create policy leave_balance_entries_select on leave_balance_entries for select using (
  tenant_id = current_actor_tenant_id()
  and (
    employee_id = current_actor_employee_id(tenant_id)
    or current_actor_has_capability(tenant_id, 'people_operations'::access_capability, employee_id)
  )
);
-- Ledger writes are RPC-only so actor, reason, and audit evidence cannot be forged client-side.
drop policy if exists leave_balance_entries_no_direct_write on leave_balance_entries;
create policy leave_balance_entries_no_direct_write on leave_balance_entries for all
using (false) with check (false);

create or replace function teamframe_leave_balance_components(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_leave_definition_id uuid,
  p_balance_year integer,
  p_as_of_date date default current_date,
  p_exclude_leave_id uuid default null
)
returns table (
  opening numeric,
  carried_forward numeric,
  accrued numeric,
  adjustments numeric,
  taken numeric,
  pending numeric,
  available numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_def leave_definitions;
  v_employee employees;
  v_company companies;
  v_annual numeric := 0;
  v_year_start date := make_date(p_balance_year, 1, 1);
  v_year_end date := make_date(p_balance_year, 12, 31);
  v_eligible_start date;
  v_as_of date := least(greatest(p_as_of_date, make_date(p_balance_year, 1, 1)), make_date(p_balance_year, 12, 31));
  v_prorated numeric := 0;
  v_months numeric := 0;
  v_legacy_used numeric := 0;
begin
  if p_balance_year not between 2000 and 2200 then raise exception 'INVALID_INPUT'; end if;

  select * into v_def from leave_definitions
  where tenant_id = p_tenant_id and id = p_leave_definition_id and archived_at is null;
  select * into v_employee from employees
  where tenant_id = p_tenant_id and id = p_employee_id and deleted_at is null;
  if not found or v_def.id is null then raise exception 'LEAVE_BALANCE_SCOPE_INVALID'; end if;

  select * into v_company from companies where id = p_tenant_id;
  v_annual := coalesce(
    case when v_def.system_leave_type = 'annual' then v_employee.annual_leave_entitlement_override end,
    v_def.default_entitlement_days,
    case when v_def.system_leave_type = 'annual' then v_company.annual_leave_default_days::numeric end,
    0
  );

  v_eligible_start := greatest(v_year_start, coalesce(v_employee.start_date, v_year_start));
  if v_eligible_start > v_year_end then
    v_prorated := 0;
  elsif v_def.joining_date_pro_rata then
    v_prorated := round(v_annual * ((v_year_end - v_eligible_start + 1)::numeric / (v_year_end - v_year_start + 1)::numeric), 2);
  else
    v_prorated := v_annual;
  end if;

  if not v_def.accrual_enabled then
    accrued := v_prorated;
  elsif v_as_of < v_eligible_start then
    accrued := 0;
  elsif v_def.accrual_frequency = 'annual' then
    accrued := v_prorated;
  else
    v_months := ((extract(year from v_as_of)::integer - extract(year from v_eligible_start)::integer) * 12)
      + extract(month from v_as_of)::integer - extract(month from v_eligible_start)::integer + 1;
    -- Joining-date pro-rata defines this year's entitlement ceiling. Monthly
    -- accrual is calculated once from the configured annual value, then capped
    -- at that ceiling; it must not reduce the already-prorated value a second time.
    accrued := least(v_prorated, round(v_annual * least(12, greatest(0, v_months)) / 12, 2));
  end if;

  select coalesce(sum(amount_days) filter (where entry_kind = 'opening'), 0),
         coalesce(sum(amount_days) filter (where entry_kind = 'carry_forward'), 0),
         coalesce(sum(amount_days) filter (where entry_kind = 'admin_adjustment'), 0)
  into opening, carried_forward, adjustments
  from leave_balance_entries
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and leave_definition_id = p_leave_definition_id and balance_year = p_balance_year
    and effective_date <= v_as_of;

  -- Preserve the legacy semantics: these rows describe already-used days, not opening credit.
  if v_def.system_leave_type = 'annual' then
    select coalesce(sum(used_days), 0) into v_legacy_used from leave_opening_adjustments
    where tenant_id = p_tenant_id and employee_id = p_employee_id
      and leave_type = 'annual' and period_year = p_balance_year;
  end if;

  select coalesce(sum(requested_days), 0) into taken from leaves
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and (
      leave_definition_id = p_leave_definition_id
      or (
        leave_definition_id is null
        and v_def.is_system
        and leave_type::text = v_def.system_leave_type
      )
    )
    and status = 'approved' and extract(year from start_date)::integer = p_balance_year
    and (p_exclude_leave_id is null or id <> p_exclude_leave_id);
  taken := taken + v_legacy_used;

  select coalesce(sum(requested_days), 0) into pending from leaves
  where tenant_id = p_tenant_id and employee_id = p_employee_id
    and (
      leave_definition_id = p_leave_definition_id
      or (
        leave_definition_id is null
        and v_def.is_system
        and leave_type::text = v_def.system_leave_type
      )
    )
    and status = 'pending' and extract(year from start_date)::integer = p_balance_year
    and (p_exclude_leave_id is null or id <> p_exclude_leave_id);

  opening := coalesce(opening, 0); carried_forward := coalesce(carried_forward, 0);
  adjustments := coalesce(adjustments, 0); taken := coalesce(taken, 0); pending := coalesce(pending, 0);
  available := opening + carried_forward + accrued + adjustments - taken - pending;
  return next;
end;
$$;

create or replace function teamframe_add_leave_balance_entry(
  p_tenant_id uuid, p_actor_user_id uuid, p_employee_id uuid,
  p_leave_definition_id uuid, p_balance_year integer, p_entry_kind text,
  p_amount_days numeric, p_effective_date date, p_reason text,
  p_source_year integer default null, p_idempotency_key text default null
)
returns leave_balance_entries
language plpgsql security definer set search_path = public
as $$
declare v_entry leave_balance_entries; v_cap numeric; v_source_available numeric;
begin
  if not exists (
    select 1 from tenant_memberships
    where tenant_id = p_tenant_id and auth_user_id = p_actor_user_id
      and active and removed_at is null and profile in ('admin', 'full_access')
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if p_entry_kind not in ('opening','carry_forward','admin_adjustment') or p_amount_days = 0
    or nullif(trim(coalesce(p_reason,'')), '') is null then raise exception 'INVALID_INPUT'; end if;
  if p_entry_kind = 'carry_forward' then
    select carry_forward_cap_days into v_cap from leave_definitions
      where tenant_id=p_tenant_id and id=p_leave_definition_id and carry_forward_enabled;
    if not found or p_source_year <> p_balance_year - 1 or p_amount_days < 0 then raise exception 'LEAVE_CARRY_INVALID'; end if;
    select available into v_source_available from teamframe_leave_balance_components(
      p_tenant_id,p_employee_id,p_leave_definition_id,p_source_year,make_date(p_source_year,12,31),null);
    if p_amount_days > greatest(0, least(coalesce(v_cap, v_source_available), v_source_available)) then
      raise exception 'LEAVE_CARRY_EXCEEDS_AVAILABLE';
    end if;
  elsif p_source_year is not null then raise exception 'INVALID_INPUT'; end if;

  insert into leave_balance_entries(tenant_id,employee_id,leave_definition_id,balance_year,entry_kind,
    amount_days,effective_date,reason,source_year,idempotency_key,created_by_user_id)
  values(p_tenant_id,p_employee_id,p_leave_definition_id,p_balance_year,p_entry_kind,p_amount_days,
    p_effective_date,trim(p_reason),p_source_year,p_idempotency_key,p_actor_user_id)
  on conflict (tenant_id, idempotency_key) do nothing
  returning * into v_entry;
  if v_entry.id is null and p_idempotency_key is not null then
    select * into v_entry from leave_balance_entries
    where tenant_id=p_tenant_id and idempotency_key=p_idempotency_key;
    return v_entry;
  end if;
  insert into audit_logs(tenant_id,actor_user_id,action_type,target_id)
    values(p_tenant_id,p_actor_user_id,'leave.balance_entry_created',v_entry.id);
  return v_entry;
end;
$$;

revoke all on function teamframe_leave_balance_components(uuid,uuid,uuid,integer,date,uuid) from public, anon, authenticated;
revoke all on function teamframe_add_leave_balance_entry(uuid,uuid,uuid,uuid,integer,text,numeric,date,text,integer,text) from public, anon, authenticated;
grant execute on function teamframe_leave_balance_components(uuid,uuid,uuid,integer,date,uuid) to service_role;
grant execute on function teamframe_add_leave_balance_entry(uuid,uuid,uuid,uuid,integer,text,numeric,date,text,integer,text) to service_role;
