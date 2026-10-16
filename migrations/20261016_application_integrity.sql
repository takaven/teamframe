-- TeamFrame existing-install integrity correction
-- Protects the last effective access administrator and immutable published policy evidence.

begin;

create or replace function teamframe_protect_last_access_administrator()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old_effective boolean;
  v_new_effective boolean;
begin
  v_old_effective := old.active
    and old.removed_at is null
    and coalesce(old.manage_users_access, old.profile = 'full_access');

  if tg_op = 'DELETE' then
    v_new_effective := false;
  else
    v_new_effective := new.active
      and new.removed_at is null
      and coalesce(new.manage_users_access, new.profile = 'full_access');
  end if;

  if v_old_effective and not v_new_effective then
    perform 1 from companies where id = old.tenant_id for update;

    if not exists (
      select 1
      from tenant_memberships tm
      where tm.tenant_id = old.tenant_id
        and tm.id <> old.id
        and tm.active = true
        and tm.removed_at is null
        and coalesce(tm.manage_users_access, tm.profile = 'full_access')
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'LAST_ACCESS_ADMIN_REQUIRED';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tenant_memberships_protect_last_access_administrator on tenant_memberships;
create trigger tenant_memberships_protect_last_access_administrator
before update of profile, active, removed_at, manage_users_access or delete on tenant_memberships
for each row
execute function teamframe_protect_last_access_administrator();

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

commit;
