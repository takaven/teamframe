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
-- Phase 5A (additive): link a request to the configured leave_definition it was raised
-- under. Nullable — legacy rows keep leave_type only. FK added in leave_definitions.sql.
alter table leaves add column if not exists leave_definition_id uuid;
create index if not exists leaves_definition_idx on leaves(tenant_id, leave_definition_id) where leave_definition_id is not null;
-- Phase 5A (additive): the private-bucket document holding this request's supporting
-- evidence (sick note, etc.), stored through the existing document/upload infra. Nullable —
-- most requests carry no evidence. ON DELETE SET NULL so purging a document never deletes leave.
alter table leaves add column if not exists attachment_document_id uuid;
do $$ begin
  alter table leaves add constraint leaves_attachment_document_fk
    foreign key (attachment_document_id) references documents(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists leaves_attachment_document_idx on leaves(tenant_id, attachment_document_id) where attachment_document_id is not null;

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
create index if not exists leave_opening_adjustments_employee_idx on leave_opening_adjustments(tenant_id, employee_id);

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
