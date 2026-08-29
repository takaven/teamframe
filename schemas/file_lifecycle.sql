-- TeamFrame hardening — durable file operation and export retention evidence.

do $$ begin
  create type file_operation_kind as enum (
    'document_upload',
    'document_delete',
    'export_generation',
    'export_delete'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter type file_operation_kind add value if not exists 'position_jd_upload';
  alter type file_operation_kind add value if not exists 'position_jd_delete';
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_operation_status as enum (
    'pending',
    'succeeded',
    'failed',
    'compensation_required',
    'compensated'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type export_file_kind as enum (
    'due_diligence_pack',
    'finance_handoff',
    'tenant_export'
  );
exception when duplicate_object then null; end $$;

-- Additive for installations created before the whole-tenant portability export.
-- `add value if not exists` is idempotent and safe to re-run.
do $$ begin
  alter type export_file_kind add value if not exists 'tenant_export';
exception when duplicate_object then null; end $$;

create table if not exists file_operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  operation_kind file_operation_kind not null,
  status file_operation_status not null default 'pending',
  idempotency_key text not null,
  storage_bucket text not null,
  storage_path text not null,
  target_id uuid,
  audit_action_type text,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz,
  check (char_length(idempotency_key) between 1 and 120),
  check (char_length(storage_bucket) between 1 and 120),
  check (char_length(storage_path) between 1 and 700),
  check (error_message is null or char_length(error_message) <= 1000)
);

create unique index if not exists file_operations_idempotency_key_idx
  on file_operations(tenant_id, operation_kind, idempotency_key);
create index if not exists file_operations_tenant_status_idx
  on file_operations(tenant_id, status, created_at);

create table if not exists export_files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  export_kind export_file_kind not null,
  employee_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  deletion_operation_id uuid references file_operations(id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(storage_bucket) between 1 and 120),
  check (char_length(storage_path) between 1 and 700),
  check (char_length(file_name) between 1 and 180),
  check (byte_size > 0)
);

create unique index if not exists export_files_storage_path_idx
  on export_files(storage_bucket, storage_path);
create index if not exists export_files_tenant_expiry_idx
  on export_files(tenant_id, expires_at)
  where deleted_at is null;

do $$ begin
  alter table export_files
    add constraint export_files_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

create or replace function file_operations_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists file_operations_set_updated_at on file_operations;
create trigger file_operations_set_updated_at
before update on file_operations
for each row
execute function file_operations_touch_updated_at();
