-- TeamFrame hardening — tenant-owned relationship integrity.
--
-- This migration is intentionally fail-fast. It does not repair, reassign, or
-- delete questionable records. If any cross-tenant or orphaned relationship is
-- present, the operator must investigate the data before applying constraints.

do $$
begin
  if exists (
    select 1
    from documents d
    left join employees e on e.id = d.employee_id
    where e.id is null or d.tenant_id <> e.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: documents.employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from leaves l
    left join employees e on e.id = l.employee_id
    where e.id is null or l.tenant_id <> e.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: leaves.employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from onboarding_tasks ot
    left join employees e on e.id = ot.employee_id
    where e.id is null or ot.tenant_id <> e.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: onboarding_tasks.employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from compensation c
    left join employees e on e.id = c.employee_id
    where e.id is null or c.tenant_id <> e.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: compensation.employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from employee_profiles ep
    left join employees e on e.id = ep.employee_id
    where e.id is null or ep.tenant_id <> e.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: employee_profiles.employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from risk_signals rs
    left join employees e on e.id = rs.subject_employee_id
    where rs.subject_employee_id is not null
      and (e.id is null or rs.tenant_id <> e.tenant_id)
  ) then
    raise exception 'tenant_integrity preflight failed: risk_signals.subject_employee_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from risk_signals rs
    left join documents d on d.id = rs.subject_document_id
    where rs.subject_document_id is not null
      and (d.id is null or rs.tenant_id <> d.tenant_id)
  ) then
    raise exception 'tenant_integrity preflight failed: risk_signals.subject_document_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from action_items ai
    left join risk_signals rs on rs.id = ai.risk_signal_id
    where rs.id is null or ai.tenant_id <> rs.tenant_id
  ) then
    raise exception 'tenant_integrity preflight failed: action_items.risk_signal_id is orphaned or cross-tenant';
  end if;

  if exists (
    select 1
    from action_items ai
    left join employees e on e.id = ai.subject_employee_id
    where ai.subject_employee_id is not null
      and (e.id is null or ai.tenant_id <> e.tenant_id)
  ) then
    raise exception 'tenant_integrity preflight failed: action_items.subject_employee_id is orphaned or cross-tenant';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_tenant_id_id_key'
      and conrelid = 'documents'::regclass
  ) then
    alter table documents
      add constraint documents_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'risk_signals_tenant_id_id_key'
      and conrelid = 'risk_signals'::regclass
  ) then
    alter table risk_signals
      add constraint risk_signals_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

do $$ begin
  alter table documents
    add constraint documents_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table leaves
    add constraint leaves_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table onboarding_tasks
    add constraint onboarding_tasks_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table compensation
    add constraint compensation_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table employee_profiles
    add constraint employee_profiles_tenant_employee_fk
      foreign key (tenant_id, employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table risk_signals
    add constraint risk_signals_tenant_employee_fk
      foreign key (tenant_id, subject_employee_id) references employees(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table risk_signals
    add constraint risk_signals_tenant_document_fk
      foreign key (tenant_id, subject_document_id) references documents(tenant_id, id) on delete set null (subject_document_id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table action_items
    add constraint action_items_tenant_risk_signal_fk
      foreign key (tenant_id, risk_signal_id) references risk_signals(tenant_id, id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table action_items
    add constraint action_items_tenant_employee_fk
      foreign key (tenant_id, subject_employee_id) references employees(tenant_id, id) on delete set null (subject_employee_id);
exception when duplicate_object then null; end $$;
