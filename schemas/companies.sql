-- TeamFrame V1 — companies (tenant root)
-- Every operational row in TeamFrame is scoped to exactly one company.

create extension if not exists "pgcrypto";

create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  created_at  timestamptz not null default now(),
  archived_at timestamptz,
  country     text,
  location    text,
  annual_leave_default_days integer,
  sick_leave_default_days integer,
  unpaid_leave_enabled boolean not null default true,
  other_leave_enabled boolean not null default true,
  setup_completed_at timestamptz,
  setup_completed_by uuid,
  check (country is null or char_length(country) between 2 and 100),
  check (location is null or char_length(location) <= 160),
  check (annual_leave_default_days is null or annual_leave_default_days between 0 and 365),
  check (sick_leave_default_days is null or sick_leave_default_days between 0 and 365)
);

alter table companies add column if not exists country text;
alter table companies add column if not exists location text;
alter table companies add column if not exists annual_leave_default_days integer;
alter table companies add column if not exists sick_leave_default_days integer;
alter table companies add column if not exists unpaid_leave_enabled boolean not null default true;
alter table companies add column if not exists other_leave_enabled boolean not null default true;
alter table companies add column if not exists setup_completed_at timestamptz;
alter table companies add column if not exists setup_completed_by uuid;

alter table companies enable row level security;

create unique index if not exists companies_slug_idx on companies(slug);

-- Bootstrap a deterministic local tenant so schema upgrades can backfill rows.
insert into companies (id, name, slug)
values (
  '00000000-0000-0000-0000-000000000001',
  'Default Company',
  'default-company'
)
on conflict (id) do nothing;
