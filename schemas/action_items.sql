-- TeamFrame FPORS — action_items

create extension if not exists "pgcrypto";

do $$ begin
	create type action_item_status as enum ('open', 'in_progress', 'done', 'dismissed');
exception when duplicate_object then null; end $$;

create table if not exists action_items (
	id uuid primary key default gen_random_uuid(),
	tenant_id uuid not null references companies(id) on delete restrict,
	risk_signal_id uuid not null references risk_signals(id) on delete cascade,
	subject_employee_id uuid references employees(id) on delete set null,
	category text not null,
	title text not null,
	suggested_action text not null,
	status action_item_status not null default 'open',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	resolved_at timestamptz,
	resolved_by_user_id uuid
);

create index if not exists action_items_tenant_id_idx on action_items(tenant_id);
create index if not exists action_items_risk_signal_id_idx on action_items(risk_signal_id);
create index if not exists action_items_subject_employee_id_idx on action_items(subject_employee_id);
create index if not exists action_items_status_idx on action_items(status);

create unique index if not exists action_items_open_per_signal_idx
	on action_items(tenant_id, risk_signal_id)
	where status in ('open', 'in_progress');

create or replace function action_items_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = clock_timestamp();
	return new;
end;
$$;

drop trigger if exists action_items_set_updated_at on action_items;
create trigger action_items_set_updated_at
before update on action_items
for each row
execute function action_items_touch_updated_at();
