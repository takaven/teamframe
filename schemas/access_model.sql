-- TeamFrame — production access model
-- Database-backed membership, capability exceptions and Platform Owner authority.

create extension if not exists "pgcrypto";

do $$ begin
  create type tenant_status as enum ('active', 'suspended', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_setup_state as enum (
    'awaiting_customer_data',
    'provisioning',
    'needs_correction',
    'ready_for_activation',
    'active',
    'suspended',
    'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_profile as enum ('admin', 'finance', 'full_access', 'employee');
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

do $$ begin
  create type access_scope as enum ('whole_company', 'own_team', 'department', 'selected_people');
exception when duplicate_object then null; end $$;

do $$ begin
  create type access_effect as enum ('allow', 'restrict');
exception when duplicate_object then null; end $$;

alter table companies add column if not exists status tenant_status not null default 'active';
alter table companies add column if not exists setup_state tenant_setup_state not null default 'awaiting_customer_data';
alter table companies add column if not exists intake_completed_at timestamptz;
alter table companies add column if not exists setup_due_at timestamptz;
alter table companies add column if not exists activated_at timestamptz;
alter table companies add column if not exists suspended_at timestamptz;
alter table companies add column if not exists closed_at timestamptz;

create table if not exists platform_owners (
  auth_user_id uuid primary key,
  display_name text not null,
  email text not null,
  active boolean not null default true,
  mfa_required boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists platform_owner_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid not null,
  replacement_auth_user_id uuid,
  replacement_email text not null,
  replacement_display_name text not null,
  state text not null default 'pending',
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  check (state in ('pending', 'accepted', 'cancelled'))
);

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  auth_user_id uuid not null,
  employee_id uuid references employees(id) on delete set null,
  email text not null,
  display_name text not null,
  profile access_profile not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  suspended_at timestamptz,
  removed_at timestamptz,
  constraint tenant_memberships_tenant_auth_unique unique (tenant_id, auth_user_id),
  constraint tenant_memberships_tenant_id_id_unique unique (tenant_id, id),
  constraint tenant_memberships_tenant_employee_unique unique (tenant_id, employee_id),
  constraint tenant_memberships_employee_same_tenant_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id)
);

create table if not exists tenant_access_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  email text not null,
  display_name text not null,
  employee_id uuid references employees(id) on delete set null,
  profile access_profile not null default 'employee',
  active boolean not null default true,
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

create table if not exists tenant_access_invitation_rules (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references tenant_access_invitations(id) on delete cascade,
  tenant_id uuid not null references companies(id) on delete restrict,
  capability access_capability not null,
  effect access_effect not null,
  scope access_scope not null default 'whole_company',
  department text,
  employee_id uuid,
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  check (
    (scope = 'department' and department is not null and employee_id is null)
    or (scope = 'selected_people' and employee_id is not null and department is null)
    or (scope in ('whole_company', 'own_team') and department is null and employee_id is null)
  ),
  constraint tenant_access_invitation_rules_tenant_invitation_fk
    foreign key (tenant_id, invitation_id) references tenant_access_invitations(tenant_id, id) on delete cascade,
  constraint tenant_access_invitation_rules_tenant_employee_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade
);

create table if not exists membership_access_rules (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references tenant_memberships(id) on delete cascade,
  tenant_id uuid not null references companies(id) on delete restrict,
  capability access_capability not null,
  effect access_effect not null,
  scope access_scope not null default 'whole_company',
  department text,
  employee_id uuid,
  created_at timestamptz not null default now(),
  created_by_user_id uuid,
  check (
    (scope = 'department' and department is not null and employee_id is null)
    or (scope = 'selected_people' and employee_id is not null and department is null)
    or (scope in ('whole_company', 'own_team') and department is null and employee_id is null)
  ),
  constraint membership_access_rules_tenant_membership_fk
    foreign key (tenant_id, membership_id) references tenant_memberships(tenant_id, id) on delete cascade,
  constraint membership_access_rules_tenant_employee_fk
    foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade
);

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

create index if not exists companies_status_idx on companies(status);
create index if not exists companies_setup_state_idx on companies(setup_state);
create index if not exists platform_owners_email_idx on platform_owners(lower(email));
create index if not exists platform_owner_transfer_requests_state_idx on platform_owner_transfer_requests(state);
create index if not exists tenant_memberships_auth_user_idx on tenant_memberships(auth_user_id);
create index if not exists tenant_memberships_tenant_idx on tenant_memberships(tenant_id);
create index if not exists tenant_memberships_employee_idx on tenant_memberships(employee_id);
create index if not exists tenant_access_invitations_tenant_idx on tenant_access_invitations(tenant_id);
create index if not exists tenant_access_invitations_email_idx on tenant_access_invitations(lower(email));
create index if not exists tenant_access_invitation_rules_invitation_idx on tenant_access_invitation_rules(invitation_id);
create index if not exists tenant_access_invitation_rules_tenant_capability_idx on tenant_access_invitation_rules(tenant_id, capability);
create index if not exists membership_access_rules_membership_idx on membership_access_rules(membership_id);
create index if not exists membership_access_rules_tenant_capability_idx on membership_access_rules(tenant_id, capability);
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

create or replace function is_current_actor_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from platform_owners po
    where po.auth_user_id = auth.uid()
      and po.active
      and po.revoked_at is null
  );
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
    join companies c on c.id = tm.tenant_id
    where tm.auth_user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.active
      and tm.removed_at is null
      and c.status = 'active'
  );
$$;

create or replace function current_actor_has_profile(p_tenant_id uuid, p_profiles access_profile[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_current_actor_platform_owner()
    or exists (
      select 1
      from tenant_memberships tm
      join companies c on c.id = tm.tenant_id
      where tm.auth_user_id = auth.uid()
        and tm.tenant_id = p_tenant_id
        and tm.profile = any(p_profiles)
        and tm.active
        and tm.removed_at is null
        and c.status = 'active'
    );
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
  join companies c on c.id = tm.tenant_id
  where tm.auth_user_id = auth.uid()
    and tm.tenant_id = p_tenant_id
    and tm.active
    and tm.removed_at is null
    and c.status = 'active'
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
  join companies c on c.id = tm.tenant_id
  where tm.auth_user_id = auth.uid()
    and tm.tenant_id = p_tenant_id
    and tm.active
    and tm.removed_at is null
    and c.status = 'active'
  order by tm.created_at asc, tm.id asc
  limit 1;
$$;

create or replace function current_actor_has_access_rule(
  p_tenant_id uuid,
  p_capability access_capability,
  p_effect access_effect,
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
    from membership_access_rules mar
    join tenant_memberships tm
      on tm.id = mar.membership_id
     and tm.tenant_id = mar.tenant_id
    where tm.auth_user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.active
      and tm.removed_at is null
      and mar.capability = p_capability
      and mar.effect = p_effect
      and (
        mar.scope = 'whole_company'
        or (
          mar.scope = 'selected_people'
          and p_employee_id is not null
          and mar.employee_id = p_employee_id
        )
        or (
          mar.scope = 'department'
          and p_department is not null
          and mar.department = p_department
        )
        or (
          mar.scope = 'own_team'
          and p_employee_id is not null
          and exists (
            select 1
            from employees e
            where e.tenant_id = p_tenant_id
              and e.id = p_employee_id
              and e.manager_id = tm.employee_id
              and e.deleted_at is null
          )
        )
      )
  );
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
  select is_current_actor_platform_owner()
    or (
      not current_actor_has_access_rule(p_tenant_id, p_capability, 'restrict', p_employee_id, p_department)
      and (
        current_actor_has_access_rule(p_tenant_id, p_capability, 'allow', p_employee_id, p_department)
        or exists (
          select 1
          from tenant_memberships tm
          join companies c on c.id = tm.tenant_id
          where tm.auth_user_id = auth.uid()
            and tm.tenant_id = p_tenant_id
            and tm.active
            and tm.removed_at is null
            and c.status = 'active'
            and (
              (p_capability = 'people_operations' and tm.profile in ('admin', 'full_access'))
              or (p_capability = 'compensation_view' and tm.profile in ('finance', 'full_access'))
              or (p_capability = 'compensation_manage' and tm.profile = 'full_access')
              or (p_capability = 'private_employee_documents' and tm.profile = 'full_access')
              or (p_capability = 'finance_payroll_exports' and tm.profile in ('finance', 'full_access'))
              or (p_capability = 'company_access_settings' and tm.profile = 'full_access')
            )
        )
        or (
          p_capability in ('people_operations', 'compensation_view')
          and p_employee_id is not null
          and exists (
            select 1
            from tenant_memberships tm
            join employees e
              on e.tenant_id = tm.tenant_id
             and e.id = p_employee_id
             and e.manager_id = tm.employee_id
             and e.deleted_at is null
            join companies c on c.id = tm.tenant_id
            where tm.auth_user_id = auth.uid()
              and tm.tenant_id = p_tenant_id
              and tm.active
              and tm.removed_at is null
              and c.status = 'active'
          )
        )
      )
    );
$$;

create or replace function current_actor_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when is_current_actor_platform_owner() then null::uuid
    else (
      select tm.tenant_id
      from tenant_memberships tm
      join companies c on c.id = tm.tenant_id
      where tm.auth_user_id = auth.uid()
        and tm.active
        and tm.removed_at is null
        and c.status = 'active'
      order by tm.created_at asc, tm.id asc
      limit 1
    )
  end;
$$;

create or replace function is_current_actor_admin()
returns boolean
language sql
stable
as $$
  select current_actor_has_profile(current_actor_tenant_id(), array['admin'::access_profile, 'full_access'::access_profile]);
$$;

alter table platform_owners enable row level security;
alter table platform_owner_transfer_requests enable row level security;
alter table tenant_memberships enable row level security;
alter table tenant_access_invitations enable row level security;
alter table tenant_access_invitation_rules enable row level security;
alter table membership_access_rules enable row level security;
alter table setup_import_batches enable row level security;
alter table leave_opening_adjustments enable row level security;
alter table employee_payment_details enable row level security;

drop policy if exists platform_owners_self_or_platform_owner on platform_owners;
drop policy if exists platform_owners_self_or_platform on platform_owners;
create policy platform_owners_self_or_platform_owner on platform_owners
for select
using (auth_user_id = auth.uid() or is_current_actor_platform_owner());

drop policy if exists platform_owners_write_blocked on platform_owners;
create policy platform_owners_write_blocked on platform_owners
for all
using (false)
with check (false);

drop policy if exists platform_owner_transfer_requests_select on platform_owner_transfer_requests;
create policy platform_owner_transfer_requests_select on platform_owner_transfer_requests
for select
using (is_current_actor_platform_owner() or replacement_auth_user_id = auth.uid());

drop policy if exists platform_owner_transfer_requests_write_blocked on platform_owner_transfer_requests;
create policy platform_owner_transfer_requests_write_blocked on platform_owner_transfer_requests
for all
using (false)
with check (false);

drop policy if exists tenant_memberships_select on tenant_memberships;
create policy tenant_memberships_select on tenant_memberships
for select
using (
  is_current_actor_platform_owner()
  or auth_user_id = auth.uid()
  or current_actor_has_profile(tenant_id, array['full_access'::access_profile])
);

drop policy if exists tenant_memberships_write_blocked on tenant_memberships;
create policy tenant_memberships_write_blocked on tenant_memberships
for all
using (false)
with check (false);

drop policy if exists tenant_access_invitations_select on tenant_access_invitations;
create policy tenant_access_invitations_select on tenant_access_invitations
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability)
);

drop policy if exists tenant_access_invitations_write_blocked on tenant_access_invitations;
create policy tenant_access_invitations_write_blocked on tenant_access_invitations
for all
using (false)
with check (false);

drop policy if exists tenant_access_invitation_rules_select on tenant_access_invitation_rules;
create policy tenant_access_invitation_rules_select on tenant_access_invitation_rules
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'company_access_settings'::access_capability)
);

drop policy if exists tenant_access_invitation_rules_write_blocked on tenant_access_invitation_rules;
create policy tenant_access_invitation_rules_write_blocked on tenant_access_invitation_rules
for all
using (false)
with check (false);

drop policy if exists membership_access_rules_select on membership_access_rules;
create policy membership_access_rules_select on membership_access_rules
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_profile(tenant_id, array['full_access'::access_profile])
  or membership_id in (
    select id from tenant_memberships where auth_user_id = auth.uid()
  )
);

drop policy if exists membership_access_rules_write_blocked on membership_access_rules;
create policy membership_access_rules_write_blocked on membership_access_rules
for all
using (false)
with check (false);

drop policy if exists setup_import_batches_select on setup_import_batches;
create policy setup_import_batches_select on setup_import_batches
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_profile(tenant_id, array['full_access'::access_profile])
);

drop policy if exists setup_import_batches_write_blocked on setup_import_batches;
create policy setup_import_batches_write_blocked on setup_import_batches
for all
using (false)
with check (false);

drop policy if exists leave_opening_adjustments_select on leave_opening_adjustments;
create policy leave_opening_adjustments_select on leave_opening_adjustments
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_profile(tenant_id, array['full_access'::access_profile, 'finance'::access_profile])
);

drop policy if exists leave_opening_adjustments_write_blocked on leave_opening_adjustments;
create policy leave_opening_adjustments_write_blocked on leave_opening_adjustments
for all
using (false)
with check (false);

drop policy if exists companies_select_tenant_scoped on companies;
create policy companies_select_tenant_scoped on companies
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_membership(id)
);

drop policy if exists companies_write_admin on companies;
create policy companies_write_admin on companies
for all
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(id, 'company_access_settings'::access_capability)
)
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(id, 'company_access_settings'::access_capability)
);

drop policy if exists employees_select on employees;
create policy employees_select on employees
for select
using (
  is_current_actor_platform_owner()
  or (
    tenant_id = current_actor_tenant_id()
    and deleted_at is null
    and (
      current_actor_has_capability(tenant_id, 'people_operations'::access_capability, id, department)
      or current_actor_employee_id(tenant_id) = id
    )
  )
);

drop policy if exists compensation_admin_only on compensation;
drop policy if exists compensation_access on compensation;
create policy compensation_access on compensation
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_view'::access_capability, employee_id)
);

drop policy if exists compensation_mutation on compensation;
drop policy if exists compensation_write_access on compensation;
drop policy if exists compensation_insert_access on compensation;
drop policy if exists compensation_update_access on compensation;
drop policy if exists compensation_delete_access on compensation;
create policy compensation_insert_access on compensation
for insert
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

create policy compensation_update_access on compensation
for update
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
)
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

create policy compensation_delete_access on compensation
for delete
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

drop policy if exists employee_payment_details_select on employee_payment_details;
create policy employee_payment_details_select on employee_payment_details
for select
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

drop policy if exists employee_payment_details_write on employee_payment_details;
drop policy if exists employee_payment_details_insert on employee_payment_details;
drop policy if exists employee_payment_details_update on employee_payment_details;
drop policy if exists employee_payment_details_delete on employee_payment_details;
create policy employee_payment_details_insert on employee_payment_details
for insert
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

create policy employee_payment_details_update on employee_payment_details
for update
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
)
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

create policy employee_payment_details_delete on employee_payment_details
for delete
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)
);

drop policy if exists documents_select on documents;
create policy documents_select on documents
for select
using (
  deleted_at is null
  and (
    is_current_actor_platform_owner()
    or (
      tenant_id = current_actor_tenant_id()
      and (
        current_actor_employee_id(tenant_id) = employee_id
        or current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
      )
    )
  )
);

drop policy if exists documents_write_admin on documents;
drop policy if exists documents_write_access on documents;
create policy documents_write_access on documents
for all
using (
  is_current_actor_platform_owner()
  or (
    tenant_id = current_actor_tenant_id()
    and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
  )
)
with check (
  is_current_actor_platform_owner()
  or (
    tenant_id = current_actor_tenant_id()
    and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id)
  )
);

drop policy if exists export_files_admin_only on export_files;
drop policy if exists export_files_access on export_files;
create policy export_files_access on export_files
for select
using (
  is_current_actor_platform_owner()
  or (
    tenant_id = current_actor_tenant_id()
    and (
      (export_kind = 'finance_handoff' and current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability))
      or (export_kind = 'due_diligence_pack' and employee_id is not null and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id))
    )
  )
);

drop policy if exists export_files_write_access on export_files;
create policy export_files_write_access on export_files
for all
using (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
  or (employee_id is not null and current_actor_has_capability(tenant_id, 'private_employee_documents'::access_capability, employee_id))
)
with check (
  is_current_actor_platform_owner()
  or current_actor_has_capability(tenant_id, 'finance_payroll_exports'::access_capability)
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
