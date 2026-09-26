-- Versioned, additive migration for tenant-defined employee custom fields.
create table if not exists custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  field_type text not null check (field_type in ('text','number','date','yes_no','single_select')),
  choices jsonb not null default '[]'::jsonb check (jsonb_typeof(choices) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists custom_field_definitions_tenant_label on custom_field_definitions (tenant_id, lower(label));

create table if not exists custom_field_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  definition_id uuid not null references custom_field_definitions(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete cascade,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, definition_id, employee_id)
);
create index if not exists custom_field_values_employee on custom_field_values (tenant_id, employee_id);

alter table custom_field_definitions enable row level security;
alter table custom_field_values enable row level security;
drop policy if exists custom_field_definitions_select on custom_field_definitions;
create policy custom_field_definitions_select on custom_field_definitions for select using (tenant_id = current_actor_tenant_id());
drop policy if exists custom_field_definitions_write on custom_field_definitions;
create policy custom_field_definitions_write on custom_field_definitions for all using (current_actor_has_capability(tenant_id, 'people_operations'::access_capability)) with check (current_actor_has_capability(tenant_id, 'people_operations'::access_capability));
drop policy if exists custom_field_values_select on custom_field_values;
create policy custom_field_values_select on custom_field_values for select using (tenant_id = current_actor_tenant_id() and (employee_id = current_actor_employee_id(tenant_id) or current_actor_has_capability(tenant_id, 'people_operations'::access_capability, employee_id)));
drop policy if exists custom_field_values_write on custom_field_values;
create policy custom_field_values_write on custom_field_values for all using (current_actor_has_capability(tenant_id, 'people_operations'::access_capability, employee_id)) with check (current_actor_has_capability(tenant_id, 'people_operations'::access_capability, employee_id));
