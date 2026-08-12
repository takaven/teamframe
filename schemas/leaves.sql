-- TeamFrame MR-6 — leave administration.
-- Basic date-based leave, balances, approval, cancellation, and absence truth.
-- No statutory entitlement engine, accrual, carry-forward, payroll calculation, or manager delegation.

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum ('annual', 'sick', 'unpaid', 'other');
exception when duplicate_object then null; end $$;

alter type leave_status add value if not exists 'cancelled';

create table if not exists leaves (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  employee_id uuid        not null references employees(id) on delete cascade,
  start_date  date        not null,
  end_date    date        not null,
  leave_type  leave_type  not null default 'annual',
  requested_days numeric(6,2) not null default 1,
  reason      text,
  status      leave_status not null default 'pending',
  decided_by_user_id uuid,
  decided_at timestamptz,
  decision_note text,
  override_insufficient_balance boolean not null default false,
  override_reason text,
  cancelled_by_user_id uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  approval_automation_item_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date),
  check (requested_days > 0),
  check (reason is null or char_length(reason) <= 500),
  check (decision_note is null or char_length(decision_note) <= 500),
  check (override_reason is null or char_length(override_reason) <= 500),
  check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  check (
    override_insufficient_balance = false
    or nullif(trim(coalesce(override_reason, '')), '') is not null
  )
);

alter table leaves add column if not exists tenant_id uuid;
alter table leaves add column if not exists updated_at timestamptz not null default now();
alter table leaves add column if not exists leave_type leave_type not null default 'annual';
alter table leaves add column if not exists requested_days numeric(6,2) not null default 1;
alter table leaves add column if not exists reason text;
alter table leaves add column if not exists decided_by_user_id uuid;
alter table leaves add column if not exists decided_at timestamptz;
alter table leaves add column if not exists decision_note text;
alter table leaves add column if not exists override_insufficient_balance boolean not null default false;
alter table leaves add column if not exists override_reason text;
alter table leaves add column if not exists cancelled_by_user_id uuid;
alter table leaves add column if not exists cancelled_at timestamptz;
alter table leaves add column if not exists cancellation_reason text;
alter table leaves add column if not exists approval_automation_item_id uuid;

update leaves l
set tenant_id = e.tenant_id
from employees e
where l.employee_id = e.id
  and l.tenant_id is null;

alter table leaves
  alter column tenant_id set not null;

do $$ begin
  alter table leaves
    add constraint leaves_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists leaves_employee_id_idx on leaves(employee_id);
create index if not exists leaves_tenant_id_idx   on leaves(tenant_id);
create index if not exists leaves_status_idx      on leaves(status);
create index if not exists leaves_type_idx        on leaves(tenant_id, leave_type);
create index if not exists leaves_period_idx      on leaves(tenant_id, employee_id, start_date, end_date);
create index if not exists leaves_approval_automation_idx on leaves(tenant_id, approval_automation_item_id)
  where approval_automation_item_id is not null;

create or replace function leaves_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists leaves_set_updated_at on leaves;
create trigger leaves_set_updated_at
before update on leaves
for each row
execute function leaves_touch_updated_at();
