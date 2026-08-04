-- TeamFrame V1 -- policies
-- Scope lock: versioned governance rules, tenant-scoped.

create table if not exists policies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  title       text        not null,
  body        text        not null,
  version     integer     not null default 1,
  is_published boolean    not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (version >= 1)
);

alter table policies add column if not exists tenant_id uuid;
alter table policies add column if not exists version integer not null default 1;
alter table policies add column if not exists is_published boolean not null default false;
alter table policies add column if not exists updated_at timestamptz not null default now();

update policies
set tenant_id = '00000000-0000-0000-0000-000000000001'
where tenant_id is null;

alter table policies
  alter column tenant_id set not null;

do $$ begin
  alter table policies
    add constraint policies_tenant_fk
      foreign key (tenant_id) references companies(id) on delete restrict;
exception when duplicate_object then null; end $$;

create index if not exists policies_tenant_id_idx on policies(tenant_id);
create index if not exists policies_archived_at_idx on policies(archived_at);
create index if not exists policies_published_idx on policies(is_published);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'policies_tenant_id_id_key'
      and conrelid = 'policies'::regclass
  ) then
    alter table policies
      add constraint policies_tenant_id_id_key unique (tenant_id, id);
  end if;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create or replace function policies_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists policies_set_updated_at on policies;
create trigger policies_set_updated_at
before update on policies
for each row
execute function policies_touch_updated_at();

create or replace function teamframe_create_policy(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_title text,
  p_body text,
  p_version integer
)
returns policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy policies;
begin
  insert into policies (tenant_id, title, body, version, is_published)
  values (p_tenant_id, p_title, p_body, p_version, false)
  returning * into v_policy;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'policy.created', v_policy.id);

  return v_policy;
end;
$$;

create or replace function teamframe_publish_policy(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_policy_id uuid,
  p_expected_updated_at timestamptz
)
returns policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy policies;
begin
  update policies
  set is_published = true
  where tenant_id = p_tenant_id
    and id = p_policy_id
    and is_published = false
    and updated_at = p_expected_updated_at
    and archived_at is null
  returning * into v_policy;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'policy.published', p_policy_id);

  return v_policy;
end;
$$;

create or replace function teamframe_archive_policy(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_policy_id uuid,
  p_expected_updated_at timestamptz
)
returns policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy policies;
begin
  update policies
  set archived_at = clock_timestamp()
  where tenant_id = p_tenant_id
    and id = p_policy_id
    and updated_at = p_expected_updated_at
    and archived_at is null
  returning * into v_policy;

  if not found then
    return null;
  end if;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  values (p_tenant_id, p_actor_user_id, 'policy.archived', p_policy_id);

  return v_policy;
end;
$$;
