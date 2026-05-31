-- TeamFrame FPORS — risk_signals

create extension if not exists "pgcrypto";

do $$ begin
	create type risk_signal_severity as enum ('red', 'yellow');
exception when duplicate_object then null; end $$;

create table if not exists risk_signals (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references companies(id) on delete restrict,
	kind text not null,
	trigger_reason text not null,
	severity risk_signal_severity not null,
	subject_employee_id uuid references employees(id) on delete cascade,
	subject_document_id uuid references documents(id) on delete set null,
	evidence jsonb not null default '{}'::jsonb,
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	resolved_at timestamptz,
	resolution_action_item_id uuid
);

create index if not exists risk_signals_tenant_id_idx on risk_signals(tenant_id);
create index if not exists risk_signals_kind_idx on risk_signals(kind);
create index if not exists risk_signals_trigger_reason_idx on risk_signals(trigger_reason);
create index if not exists risk_signals_subject_employee_idx on risk_signals(subject_employee_id);
create index if not exists risk_signals_subject_document_idx on risk_signals(subject_document_id);
create index if not exists risk_signals_resolved_at_idx on risk_signals(resolved_at);

drop index if exists risk_signals_open_unique_idx;

create unique index if not exists risk_signals_open_missing_contract_unique_idx
	on risk_signals (tenant_id, kind, subject_employee_id)
	where resolved_at is null and kind = 'missing_contract';

create unique index if not exists risk_signals_open_document_unique_idx
	on risk_signals (tenant_id, kind, subject_document_id)
	where resolved_at is null and kind in ('expiring_document', 'expired_document');
