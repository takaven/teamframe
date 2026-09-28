-- Group D: minimal delivery/idempotency ledger for transactional email and daily digest.
-- Stores metadata only: never message bodies, document contents, or sensitive HR fields.

do $$ begin
  create type notification_delivery_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  recipient_employee_id uuid references employees(id) on delete set null,
  recipient_email text,
  notification_type text not null check (char_length(notification_type) between 1 and 80),
  event_key text not null check (char_length(event_key) between 1 and 240),
  related_entity_type text,
  related_entity_id uuid,
  action_path text,
  status notification_delivery_status not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  last_error_summary text,
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  constraint notification_deliveries_tenant_event_unique unique (tenant_id, event_key),
  constraint notification_deliveries_employee_same_tenant_fk foreign key (tenant_id, recipient_employee_id) references employees(tenant_id, id) on delete set null
);

create index if not exists notification_deliveries_status_idx on notification_deliveries(tenant_id, status, created_at desc);
create index if not exists notification_deliveries_recipient_idx on notification_deliveries(tenant_id, recipient_employee_id, created_at desc);
alter table notification_deliveries enable row level security;

drop policy if exists notification_deliveries_admin_select on notification_deliveries;
create policy notification_deliveries_admin_select on notification_deliveries for select to authenticated
using (tenant_id = current_actor_tenant_id() and (is_current_actor_admin() or current_actor_has_capability(tenant_id, 'people_operations'::access_capability)));

drop policy if exists notification_deliveries_self_select on notification_deliveries;
create policy notification_deliveries_self_select on notification_deliveries for select to authenticated
using (tenant_id = current_actor_tenant_id() and recipient_employee_id = current_actor_employee_id(tenant_id));

revoke all on notification_deliveries from anon, authenticated;
grant select on notification_deliveries to authenticated;
grant all on notification_deliveries to service_role;
