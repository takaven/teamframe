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
  default_timezone text not null default 'UTC',
  default_working_days smallint[] not null default array[1,2,3,4,5]::smallint[],
  employee_number_prefix text,
  employee_number_separator text not null default '-',
  employee_number_digits integer not null default 4,
  employee_number_next integer not null default 1,
  unpaid_leave_enabled boolean not null default true,
  other_leave_enabled boolean not null default true,
  -- Optional automated 30-day onboarding check-in. Default true preserves current
  -- behaviour (check-ins are scheduled today); the enable/disable wiring and the
  -- "not an admin-chasing task" behaviour are implemented in a later phase.
  thirty_day_check_in_enabled boolean not null default true,
  setup_completed_at timestamptz,
  setup_completed_by uuid,
  check (country is null or char_length(country) between 2 and 100),
  check (location is null or char_length(location) <= 160),
  check (annual_leave_default_days is null or annual_leave_default_days between 0 and 365),
  check (sick_leave_default_days is null or sick_leave_default_days between 0 and 365),
  check (cardinality(default_working_days) between 1 and 7),
  check (default_working_days <@ array[1,2,3,4,5,6,7]::smallint[]),
  check (employee_number_digits between 1 and 12),
  check (employee_number_next >= 1)
);

alter table companies add column if not exists country text;
alter table companies add column if not exists location text;
alter table companies add column if not exists annual_leave_default_days integer;
alter table companies add column if not exists sick_leave_default_days integer;
alter table companies add column if not exists default_timezone text not null default 'UTC';
alter table companies add column if not exists default_working_days smallint[] not null default array[1,2,3,4,5]::smallint[];
alter table companies add column if not exists employee_number_prefix text;
alter table companies add column if not exists employee_number_separator text not null default '-';
alter table companies add column if not exists employee_number_digits integer not null default 4;
alter table companies add column if not exists employee_number_next integer not null default 1;
alter table companies add column if not exists unpaid_leave_enabled boolean not null default true;
alter table companies add column if not exists other_leave_enabled boolean not null default true;
alter table companies add column if not exists thirty_day_check_in_enabled boolean not null default true;
alter table companies add column if not exists setup_completed_at timestamptz;
alter table companies add column if not exists setup_completed_by uuid;

create table if not exists company_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, holiday_date),
  check (char_length(name) between 1 and 160)
);

create index if not exists company_holidays_tenant_date_idx on company_holidays(tenant_id, holiday_date);

alter table companies enable row level security;

create unique index if not exists companies_slug_idx on companies(slug);
