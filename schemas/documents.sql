-- TeamFrame V1 — documents
-- Scope lock: upload, download, grouped export only.
-- No e-signatures, no approvals, no versioning, no retention engine, no legal workflow.

do $$ begin
  create type document_type as enum ('CV', 'CONTRACT', 'JD', 'PHOTO');
exception when duplicate_object then null; end $$;

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  employee_id uuid        not null references employees(id) on delete cascade,
  type        document_type not null,
  file_url    text        not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

alter table documents add column if not exists tenant_id uuid;

update documents d
set tenant_id = e.tenant_id
from employees e
where d.employee_id = e.id
  and d.tenant_id is null;

alter table documents
  alter column tenant_id set not null;

do $$ begin
  alter table documents
    add constraint documents_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists documents_employee_id_idx on documents(employee_id);
create index if not exists documents_tenant_id_idx   on documents(tenant_id);
create index if not exists documents_type_idx        on documents(type);
create index if not exists documents_deleted_at_idx  on documents(deleted_at);

-- FPORS pivot (Wave 1): expiry + signature tracking for document-expiry signals.
-- subject_person_id mirrors employee_id today; once the Person model lands
-- it will let a document attach to a non-employee subject (founder, contractor).
alter table documents add column if not exists expires_at timestamptz;
alter table documents add column if not exists document_type text;
alter table documents add column if not exists signed_at timestamptz;
alter table documents add column if not exists subject_person_id uuid;
alter table documents add column if not exists replaced_at timestamptz;
alter table documents add column if not exists replaced_by_document_id uuid;
-- Phase 5E (additive, nullable): factual identifying metadata for country-specific records
-- (e.g. UAE Visa / Emirates ID / Passport). issued_at complements the existing expires_at;
-- reference_number is the document/reference number and is SENSITIVE PII — its read path follows
-- the same private-document capability gate as the file itself (never leaked to rosters/org chart).
alter table documents add column if not exists issued_at date;
alter table documents add column if not exists reference_number text;
do $$ begin
  alter table documents add constraint documents_reference_number_len
    check (reference_number is null or char_length(reference_number) between 1 and 120);
exception when duplicate_object then null; end $$;

update documents
set document_type = lower(type::text)
where document_type is null;

create index if not exists documents_expires_at_idx on documents(expires_at);
create index if not exists documents_document_type_idx on documents(document_type);
create index if not exists documents_signed_at_idx on documents(signed_at);
create index if not exists documents_subject_person_id_idx on documents(subject_person_id);
create index if not exists documents_replaced_at_idx on documents(replaced_at);

do $$ begin
  alter table documents
    add constraint documents_replaced_by_document_fk
      foreign key (replaced_by_document_id) references documents(id) on delete set null;
exception when duplicate_object then null; end $$;
