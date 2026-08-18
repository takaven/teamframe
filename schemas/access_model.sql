-- TeamFrame — independent customer access model.
-- Local customer installation authority is held by Full Access.

create extension if not exists "pgcrypto";

do $$ begin
  create type access_profile as enum ('admin', 'finance', 'full_access', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type people_access_scope as enum ('none', 'all', 'direct_reports', 'selected_people', 'all_except_selected_people');
exception when duplicate_object then null; end $$;

do $$ begin
  create type salary_access_level as enum ('none', 'view', 'manage');
exception when duplicate_object then null; end $$;

do $$ begin
  create type salary_access_scope as enum ('all', 'direct_reports', 'selected_people', 'all_except_selected_people');
exception when duplicate_object then null; end $$;

do $$ begin
  create type private_documents_scope as enum ('none', 'all', 'selected_people', 'all_except_selected_people');
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_capability as enum (
    'people_operations',
    'compensation_view',
    'compensation_manage',
    'private_employee_documents',
    'finance_payroll_exports',
    'company_access_settings'
  );
exception when duplicate_object then null; end $$;

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  auth_user_id uuid not null,
  employee_id uuid references employees(id) on delete set null,
  email text not null,
  display_name text not null,
  profile access_profile not null default 'employee',
  active boolean not null default true,
  people_access_scope people_access_scope,
  people_selected_employee_ids uuid[] not null default '{}'::uuid[],
  salary_access_level salary_access_level,
  salary_access_scope salary_access_scope,
  salary_selected_employee_ids uuid[] not null default '{}'::uuid[],
  private_documents_scope private_documents_scope,
  private_documents_selected_employee_ids uuid[] not null default '{}'::uuid[],
  finance_exports_access boolean,
  manage_users_access boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint tenant_memberships_tenant_auth_unique unique (tenant_id, auth_user_id),
  constraint tenant_memberships_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_memberships_tenant_employee_unique unique (tenant_id, employee_id),
  constraint tenant_memberships_employee_same_tenant_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id)
);

alter table tenant_memberships add column if not exists people_access_scope people_access_scope;
alter table tenant_memberships add column if not exists people_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_memberships add column if not exists salary_access_level salary_access_level;
alter table tenant_memberships add column if not exists salary_access_scope salary_access_scope;
alter table tenant_memberships add column if not exists salary_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_memberships add column if not exists private_documents_scope private_documents_scope;
alter table tenant_memberships add column if not exists private_documents_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_memberships add column if not exists finance_exports_access boolean;
alter table tenant_memberships add column if not exists manage_users_access boolean;

create table if not exists tenant_access_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  email text not null,
  display_name text not null,
  employee_id uuid references employees(id) on delete set null,
  profile access_profile not null default 'employee',
  active boolean not null default true,
  people_access_scope people_access_scope,
  people_selected_employee_ids uuid[] not null default '{}'::uuid[],
  salary_access_level salary_access_level,
  salary_access_scope salary_access_scope,
  salary_selected_employee_ids uuid[] not null default '{}'::uuid[],
  private_documents_scope private_documents_scope,
  private_documents_selected_employee_ids uuid[] not null default '{}'::uuid[],
  finance_exports_access boolean,
  manage_users_access boolean,
  invited_by_user_id uuid,
  accepted_membership_id uuid references tenant_memberships(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_access_invitations_tenant_email_unique unique (tenant_id, email),
  constraint tenant_access_invitations_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_access_invitations_employee_same_tenant_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id)
);

alter table tenant_access_invitations add column if not exists people_access_scope people_access_scope;
alter table tenant_access_invitations add column if not exists people_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_access_invitations add column if not exists salary_access_level salary_access_level;
alter table tenant_access_invitations add column if not exists salary_access_scope salary_access_scope;
alter table tenant_access_invitations add column if not exists salary_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_access_invitations add column if not exists private_documents_scope private_documents_scope;
alter table tenant_access_invitations add column if not exists private_documents_selected_employee_ids uuid[] not null default '{}'::uuid[];
alter table tenant_access_invitations add column if not exists finance_exports_access boolean;
alter table tenant_access_invitations add column if not exists manage_users_access boolean;

create table if not exists setup_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references companies(id) on delete restrict,
  uploaded_by_user_id uuid not null,
  file_name text not null,
  state text not null default 'parsed',
  validation_errors jsonb not null default '[]'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  check (state in ('parsed', 'invalid', 'validated', 'committed', 'failed'))
);

create table if not exists leave_opening_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  employee_id uuid not null,
  period_year integer not null,
  leave_type leave_type not null default 'annual',
  used_days numeric(6,2) not null default 0,
  note text,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint leave_opening_adjustments_employee_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade,
  constraint leave_opening_adjustments_unique unique (tenant_id, employee_id, period_year, leave_type),
  check (period_year between 2000 and 2200),
  check (used_days >= 0)
);

alter table documents add column if not exists sensitivity text not null default 'private';
alter table documents add column if not exists content_access_class text not null default 'private_employee';

update documents
set sensitivity = 'private',
    content_access_class = 'private_employee'
where sensitivity is null
   or content_access_class is null;

create index if not exists tenant_memberships_auth_user_idx on tenant_memberships(auth_user_id);
create index if not exists tenant_memberships_tenant_idx on tenant_memberships(tenant_id);
create index if not exists tenant_memberships_employee_idx on tenant_memberships(employee_id);
create index if not exists tenant_access_invitations_tenant_idx on tenant_access_invitations(tenant_id);
create index if not exists tenant_access_invitations_email_idx on tenant_access_invitations(lower(email));
create index if not exists leave_opening_adjustments_employee_idx on leave_opening_adjustments(tenant_id, employee_id);

create or replace function tenant_memberships_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists tenant_memberships_set_updated_at on tenant_memberships;
create trigger tenant_memberships_set_updated_at
before update on tenant_memberships
for each row
execute function tenant_memberships_touch_updated_at();

drop trigger if exists tenant_access_invitations_set_updated_at on tenant_access_invitations;
create trigger tenant_access_invitations_set_updated_at
before update on tenant_access_invitations
for each row
execute function tenant_memberships_touch_updated_at();

create or replace function current_actor_auth_user_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.uid()::text, '')::uuid;
$$;

create or replace function current_actor_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.tenant_id
  from tenant_memberships tm
  where tm.auth_user_id = auth.uid()
    and tm.active
    and tm.removed_at is null
  order by tm.created_at asc, tm.id asc
  limit 1;
$$;

create or replace function current_actor_membership_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.id
  from tenant_memberships tm
  where tm.auth_user_id = auth.uid()
    and tm.tenant_id = p_tenant_id
    and tm.active
    and tm.removed_at is null
  order by tm.created_at asc, tm.id asc
  limit 1;
$$;

create or replace function current_actor_employee_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tm.employee_id
  from tenant_memberships tm
  where tm.auth_user_id = auth.uid()
    and tm.tenant_id = p_tenant_id
    and tm.active
    and tm.removed_at is null
  order by tm.created_at asc, tm.id asc
  limit 1;
$$;

create or replace function current_actor_has_membership(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships tm
    where tm.auth_user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.active
      and tm.removed_at is null
  );
$$;

create or replace function current_actor_has_profile(p_tenant_id uuid, p_profiles access_profile[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships tm
    where tm.auth_user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.profile = any(p_profiles)
      and tm.active
      and tm.removed_at is null
  );
$$;

create or replace function teamframe_scope_matches(
  p_scope text,
  p_selected uuid[],
  p_tenant_id uuid,
  p_membership_employee_id uuid,
  p_target_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_scope = 'all' then true
    when p_scope = 'none' then false
    when p_target_employee_id is null then false
    when p_scope = 'selected_people' then p_target_employee_id = any(coalesce(p_selected, '{}'::uuid[]))
    when p_scope = 'all_except_selected_people' then not (p_target_employee_id = any(coalesce(p_selected, '{}'::uuid[])))
    when p_scope = 'direct_reports' then exists (
      select 1
      from employees e
      where e.tenant_id = p_tenant_id
        and e.id = p_target_employee_id
        and e.manager_id = p_membership_employee_id
        and e.deleted_at is null
    )
    else false
  end;
$$;

create or replace function current_actor_has_capability(
  p_tenant_id uuid,
  p_capability access_capability,
  p_employee_id uuid default null,
  p_department text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships tm
    where tm.auth_user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.active
      and tm.removed_at is null
      and (
        (
          p_capability = 'people_operations'
          and (
            coalesce(tm.people_access_scope::text, case when tm.profile in ('admin', 'full_access') then 'all' else 'none' end)
          ) <> 'none'
          and teamframe_scope_matches(
            coalesce(tm.people_access_scope::text, case when tm.profile in ('admin', 'full_access') then 'all' else 'none' end),
            tm.people_selected_employee_ids,
            tm.tenant_id,
            tm.employee_id,
            p_employee_id
          )
        )
        or (
          p_capability = 'compensation_view'
          and coalesce(tm.salary_access_level::text, case when tm.profile = 'full_access' then 'manage' when tm.profile = 'finance' then 'view' else 'none' end) in ('view', 'manage')
          and teamframe_scope_matches(
            coalesce(tm.salary_access_scope::text, 'all'),
            tm.salary_selected_employee_ids,
            tm.tenant_id,
            tm.employee_id,
            p_employee_id
          )
        )
        or (
          p_capability = 'compensation_manage'
          and coalesce(tm.salary_access_level::text, case when tm.profile = 'full_access' then 'manage' else 'none' end) = 'manage'
          and teamframe_scope_matches(
            coalesce(tm.salary_access_scope::text, 'all'),
            tm.salary_selected_employee_ids,
            tm.tenant_id,
            tm.employee_id,
            p_employee_id
          )
        )
        or (
          p_capability = 'private_employee_documents'
          and teamframe_scope_matches(
            coalesce(tm.private_documents_scope::text, case when tm.profile = 'full_access' then 'all' else 'none' end),
            tm.private_documents_selected_employee_ids,
            tm.tenant_id,
            tm.employee_id,
            p_employee_id
          )
        )
        or (
          p_capability = 'finance_payroll_exports'
          and coalesce(tm.finance_exports_access, tm.profile in ('finance', 'full_access'))
        )
        or (
          p_capability = 'company_access_settings'
          and coalesce(tm.manage_users_access, tm.profile = 'full_access')
        )
        or (
          -- Manager-derived access grants ONLY people-operations visibility of direct
          -- reports. It never grants compensation_view — salary access comes solely from
          -- the explicit salary_access scope above. (Matches the TS hasManagerDerivedAccess.)
          p_capability = 'people_operations'
          and p_employee_id is not null
          and exists (
            select 1
            from employees e
            where e.tenant_id = tm.tenant_id
              and e.id = p_employee_id
              and e.manager_id = tm.employee_id
              and e.deleted_at is null
          )
        )
      )
  );
$$;

create or replace function is_current_actor_admin()
returns boolean
language sql
stable
as $$
  select current_actor_has_profile(current_actor_tenant_id(), array['admin'::access_profile, 'full_access'::access_profile]);
$$;

alter table tenant_memberships enable row level security;
alter table tenant_access_invitations enable row level security;
alter table setup_import_batches enable row level security;
alter table leave_opening_adjustments enable row level security;
alter table employee_payment_details enable row level security;
alter table company_holidays enable row level security;

drop policy if exists tenant_memberships_select on tenant_memberships;
create policy tenant_memberships_select on tenant_memberships
for select
using (
  auth_user_id = auth.uid()
  or current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability)
);

drop policy if exists tenant_memberships_write_blocked on tenant_memberships;
create policy tenant_memberships_write_blocked on tenant_memberships
for all
using (false)
with check (false);

drop policy if exists tenant_access_invitations_select on tenant_access_invitations;
create policy tenant_access_invitations_select on tenant_access_invitations
for select
using (current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability));

drop policy if exists tenant_access_invitations_write_blocked on tenant_access_invitations;
create policy tenant_access_invitations_write_blocked on tenant_access_invitations
for all
using (false)
with check (false);

drop policy if exists setup_import_batches_select on setup_import_batches;
create policy setup_import_batches_select on setup_import_batches
for select
using (current_actor_has_profile(tenant_id, array['full_access'::access_profile]));

drop policy if exists setup_import_batches_write_blocked on setup_import_batches;
create policy setup_import_batches_write_blocked on setup_import_batches
for all
using (false)
with check (false);

drop policy if exists leave_opening_adjustments_select on leave_opening_adjustments;
create policy leave_opening_adjustments_select on leave_opening_adjustments
for select
using (current_actor_has_profile(tenant_id, array['full_access'::access_profile, 'finance'::access_profile]));

drop policy if exists leave_opening_adjustments_write_blocked on leave_opening_adjustments;
create policy leave_opening_adjustments_write_blocked on leave_opening_adjustments
for all
using (false)
with check (false);

drop policy if exists companies_select_tenant_scoped on companies;
create policy companies_select_tenant_scoped on companies
for select
using (current_actor_has_membership(id));

drop policy if exists companies_write_admin on companies;
create policy companies_write_admin on companies
for all
using (current_actor_has_capability(id, 'company_access_settings'::access_capability))
with check (current_actor_has_capability(id, 'company_access_settings'::access_capability));

drop policy if exists company_holidays_select_access on company_holidays;
create policy company_holidays_select_access on company_holidays
for select
using (current_actor_has_membership(tenant_id));

drop policy if exists company_holidays_insert_access on company_holidays;
create policy company_holidays_insert_access on company_holidays
for insert
with check (current_actor_has_capability(tenant_id, 'people_operations'::access_capability));

drop policy if exists company_holidays_update_access on company_holidays;
create policy company_holidays_update_access on company_holidays
for update
using (current_actor_has_capability(tenant_id, 'people_operations'::access_capability))
with check (current_actor_has_capability(tenant_id, 'people_operations'::access_capability));

drop policy if exists company_holidays_delete_access on company_holidays;
create policy company_holidays_delete_access on company_holidays
for delete
using (current_actor_has_capability(tenant_id, 'people_operations'::access_capability));

drop policy if exists employees_select on employees;
create policy employees_select on employees
for select
using (
  tenant_id = current_actor_tenant_id()
  and deleted_at is null
  and (
    current_actor_has_capability(tenant_id, 'people_operations'::access_capability, id, department)
    or current_actor_employee_id(tenant_id) = id
  )
);

drop policy if exists compensation_admin_only on compensation;
drop policy if exists compensation_access on compensation;
create policy compensation_access on compensation
for select
using (current_actor_has_capability(tenant_id, 'compensation_view'::access_capability, employee_id));

drop policy if exists compensation_mutation on compensation;
drop policy if exists compensation_write_access on compensation;
drop policy if exists compensation_insert_access on compensation;
drop policy if exists compensation_update_access on compensation;
drop policy if exists compensation_delete_access on compensation;
create policy compensation_insert_access on compensation
for insert
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

create policy compensation_update_access on compensation
for update
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id))
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

create policy compensation_delete_access on compensation
for delete
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

drop policy if exists employee_payment_details_select on employee_payment_details;
create policy employee_payment_details_select on employee_payment_details
for select
using (
  current_actor_employee_id(tenant_id) = employee_id
  or current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

drop policy if exists employee_payment_details_write on employee_payment_details;
drop policy if exists employee_payment_details_insert on employee_payment_details;
drop policy if exists employee_payment_details_update on employee_payment_details;
drop policy if exists employee_payment_details_delete on employee_payment_details;
create policy employee_payment_details_insert on employee_payment_details
for insert
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

create policy employee_payment_details_update on employee_payment_details
for update
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id))
with check (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

create policy employee_payment_details_delete on employee_payment_details
for delete
using (current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id));

drop policy if exists documents_select on documents;
create policy documents_select on documents
for select
using (
  deleted_at is null
  and tenant_id = current_actor_tenant_id()
  and (
    current_actor_employee_id(tenant_id) = employee_id
    or current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
  )
);

drop policy if exists documents_write_admin on documents;
drop policy if exists documents_write_access on documents;
create policy documents_write_access on documents
for all
using (
  tenant_id = current_actor_tenant_id()
  and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
)
with check (
  tenant_id = current_actor_tenant_id()
  and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
);

drop policy if exists export_files_admin_only on export_files;
drop policy if exists export_files_access on export_files;
create policy export_files_access on export_files
for select
using (
  tenant_id = current_actor_tenant_id()
  and (
    (export_kind = 'finance_handoff' and current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability))
    or (export_kind = 'due_diligence_pack' and employee_id is not null and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id))
  )
);

drop policy if exists export_files_write_access on export_files;
create policy export_files_write_access on export_files
for all
using (
  current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
  or (employee_id is not null and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id))
)
with check (
  current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
  or (employee_id is not null and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id))
);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into tenant_memberships (tenant_id, auth_user_id, employee_id, email, display_name, profile, active)
    select
      nullif(u.raw_app_meta_data ->> 'tenant_id', '')::uuid,
      u.id,
      e.id,
      lower(u.email),
      coalesce(e.full_name, lower(u.email)),
      case when coalesce(u.raw_app_meta_data ->> 'role', 'employee') = 'admin'
        then 'full_access'::access_profile
        else 'employee'::access_profile
      end,
      true
    from auth.users u
    left join employees e
      on e.auth_user_id = u.id
      or (
        lower(e.email) = lower(u.email)
        and e.tenant_id = nullif(u.raw_app_meta_data ->> 'tenant_id', '')::uuid
        and e.deleted_at is null
      )
    where nullif(u.raw_app_meta_data ->> 'tenant_id', '') is not null
    on conflict (tenant_id, auth_user_id) do update
      set profile = excluded.profile,
          employee_id = coalesce(tenant_memberships.employee_id, excluded.employee_id),
          email = excluded.email,
          display_name = excluded.display_name;
  end if;
end $$;
