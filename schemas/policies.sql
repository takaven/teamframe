-- TeamFrame V1 -- policies
-- Scope lock: versioned governance rules, tenant-scoped.

create table if not exists policies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid        not null references companies(id) on delete restrict,
  title       text        not null,
  body        text        not null,
  version     integer     not null default 1,
  is_published boolean    not null default false,
  effective_date date,
  file_storage_path text,
  file_original_name text,
  file_mime_type text,
  file_uploaded_at timestamptz,
  file_uploaded_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (version >= 1)
);

alter table policies add column if not exists tenant_id uuid;
alter table policies add column if not exists version integer not null default 1;
alter table policies add column if not exists is_published boolean not null default false;
alter table policies add column if not exists updated_at timestamptz not null default now();
-- Phase 5D (additive): the date the policy version takes effect. Nullable so legacy rows and
-- text policies without one remain valid; upload-first creation captures it as metadata.
alter table policies add column if not exists effective_date date;
alter table policies add column if not exists file_storage_path text;
alter table policies add column if not exists file_original_name text;
alter table policies add column if not exists file_mime_type text;
alter table policies add column if not exists file_uploaded_at timestamptz;
alter table policies add column if not exists file_uploaded_by uuid;

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

-- Once published, a policy version is evidence. Content changes must use the
-- existing new-version workflow so acknowledgements remain attributable.
create or replace function teamframe_protect_published_policy_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_published and (
    new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.version is distinct from old.version
    or new.effective_date is distinct from old.effective_date
    or new.file_storage_path is distinct from old.file_storage_path
    or new.file_original_name is distinct from old.file_original_name
    or new.file_mime_type is distinct from old.file_mime_type
    or new.file_uploaded_at is distinct from old.file_uploaded_at
    or new.file_uploaded_by is distinct from old.file_uploaded_by
    or new.is_published is distinct from old.is_published
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'POLICY_PUBLISHED_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists policies_protect_published_content on policies;
create trigger policies_protect_published_content
before update on policies
for each row
execute function teamframe_protect_published_policy_content();

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

-- Security-definer policy mutations must never be directly callable by end users: the service
-- (service-role) is the only authorised caller, passing actor-derived identity. Without these
-- revokes the functions default to EXECUTE for PUBLIC (incl. authenticated), which would let a
-- crafted request bypass RLS and the service-layer ownership/tenant checks.
revoke all on function teamframe_create_policy(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function teamframe_publish_policy(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function teamframe_archive_policy(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function teamframe_create_policy(uuid, uuid, text, text, integer) to service_role;
grant execute on function teamframe_publish_policy(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function teamframe_archive_policy(uuid, uuid, uuid, timestamptz) to service_role;
