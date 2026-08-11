-- TeamFrame MR-2 — durable HR automation operating layer.
--
-- This is intentionally a small background-work substrate, not a
-- founder-facing workflow builder. Later market-ready workflows can create
-- deterministic work items here and consume the same reminder, escalation,
-- completion, recurrence, retry, and audit semantics.

-- Automation is service-role/background work, so audit rows use a fixed
-- non-person actor rather than pretending a human initiated the event.
-- audit_logs.actor_user_id is intentionally non-null in the existing schema.

do $$ begin
  create type hr_automation_item_status as enum (
    'scheduled',
    'due',
    'completed',
    'failed',
    'escalated',
    'suppressed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type hr_automation_notification_level as enum (
    'background',
    'routine_reminder',
    'escalation',
    'decision'
  );
exception when duplicate_object then null; end $$;

create table if not exists hr_automation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  rule_key text not null,
  idempotency_key text not null,
  subject_type text not null,
  subject_id uuid,
  owner_employee_id uuid,
  owner_role text,
  due_at timestamptz not null,
  status hr_automation_item_status not null default 'scheduled',
  notification_level hr_automation_notification_level not null default 'background',
  reminder_stage integer not null default 0,
  last_reminded_at timestamptz,
  escalated_at timestamptz,
  completed_at timestamptz,
  completion_key text,
  recurrence_key text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(rule_key) between 1 and 120),
  check (char_length(idempotency_key) between 1 and 180),
  check (char_length(subject_type) between 1 and 80),
  check (owner_role is null or char_length(owner_role) between 1 and 80),
  check (completion_key is null or char_length(completion_key) between 1 and 180),
  check (recurrence_key is null or char_length(recurrence_key) between 1 and 180),
  check (reminder_stage >= 0),
  check (attempt_count >= 0),
  check (max_attempts between 1 and 12),
  check (error_message is null or char_length(error_message) <= 1000)
);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hr_automation_items_tenant_id_id_key'
      and conrelid = 'hr_automation_items'::regclass
  ) then
    alter table hr_automation_items
      add constraint hr_automation_items_tenant_id_id_key unique (tenant_id, id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create unique index if not exists hr_automation_items_idempotency_idx
  on hr_automation_items(tenant_id, rule_key, idempotency_key);
create index if not exists hr_automation_items_due_idx
  on hr_automation_items(tenant_id, status, due_at);
create index if not exists hr_automation_items_owner_idx
  on hr_automation_items(tenant_id, owner_employee_id)
  where owner_employee_id is not null;
create index if not exists hr_automation_items_recurrence_idx
  on hr_automation_items(tenant_id, rule_key, recurrence_key)
  where recurrence_key is not null;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hr_automation_items_tenant_owner_employee_fk'
      and conrelid = 'hr_automation_items'::regclass
  ) then
    alter table hr_automation_items
      add constraint hr_automation_items_tenant_owner_employee_fk
        foreign key (tenant_id, owner_employee_id)
        references employees(tenant_id, id)
        on delete set null (owner_employee_id);
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create table if not exists hr_automation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete restrict,
  automation_item_id uuid not null,
  event_key text not null,
  event_type text not null,
  notification_level hr_automation_notification_level not null,
  attempt integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (char_length(event_key) between 1 and 220),
  check (char_length(event_type) between 1 and 120),
  check (attempt >= 0)
);

create unique index if not exists hr_automation_events_key_idx
  on hr_automation_events(tenant_id, event_key);
create index if not exists hr_automation_events_item_idx
  on hr_automation_events(tenant_id, automation_item_id, created_at);

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'hr_automation_events_item_fk'
      and conrelid = 'hr_automation_events'::regclass
  ) then
    alter table hr_automation_events
      add constraint hr_automation_events_item_fk
        foreign key (tenant_id, automation_item_id)
        references hr_automation_items(tenant_id, id)
        on delete cascade;
  end if;
exception when duplicate_object then null; when duplicate_table then null; end $$;

create or replace function hr_automation_items_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists hr_automation_items_set_updated_at on hr_automation_items;
create trigger hr_automation_items_set_updated_at
before update on hr_automation_items
for each row
execute function hr_automation_items_touch_updated_at();

create or replace function teamframe_ensure_hr_automation_item(
  p_tenant_id uuid,
  p_rule_key text,
  p_idempotency_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_owner_employee_id uuid,
  p_due_at timestamptz,
  p_notification_level hr_automation_notification_level default 'background',
  p_recurrence_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_max_attempts integer default 3
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_event_key text;
begin
  insert into hr_automation_items (
    tenant_id,
    rule_key,
    idempotency_key,
    subject_type,
    subject_id,
    owner_employee_id,
    due_at,
    notification_level,
    recurrence_key,
    metadata,
    max_attempts
  )
  values (
    p_tenant_id,
    p_rule_key,
    p_idempotency_key,
    p_subject_type,
    p_subject_id,
    p_owner_employee_id,
    p_due_at,
    p_notification_level,
    p_recurrence_key,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_max_attempts, 3)
  )
  on conflict (tenant_id, rule_key, idempotency_key)
  do update set
    updated_at = clock_timestamp()
  returning id into v_item_id;

  v_event_key := v_item_id::text || ':created';
  insert into hr_automation_events (
    tenant_id,
    automation_item_id,
    event_key,
    event_type,
    notification_level,
    metadata
  )
  values (
    p_tenant_id,
    v_item_id,
    v_event_key,
    'automation.item_created',
    'background',
    jsonb_build_object('rule_key', p_rule_key, 'idempotency_key', p_idempotency_key)
  )
  on conflict (tenant_id, event_key) do nothing;

  insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
  select p_tenant_id, '00000000-0000-0000-0000-000000000000', 'automation.item_created', v_item_id
  where not exists (
    select 1
    from audit_logs
    where tenant_id = p_tenant_id
      and action_type = 'automation.item_created'
      and target_id = v_item_id
  );

  return v_item_id;
end;
$$;

create or replace function teamframe_run_hr_automation_item(
  p_tenant_id uuid,
  p_item_id uuid,
  p_now timestamptz default now(),
  p_complete boolean default false,
  p_fail boolean default false,
  p_error_message text default null,
  p_next_recurrence_idempotency_key text default null,
  p_next_due_at timestamptz default null,
  p_event_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item hr_automation_items%rowtype;
  v_attempt integer;
  v_event_key text;
  v_next_id uuid;
begin
  select *
  into v_item
  from hr_automation_items
  where id = p_item_id
    and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'AUTOMATION_ITEM_NOT_FOUND';
  end if;

  if v_item.status in ('completed', 'suppressed') then
    return jsonb_build_object('outcome', 'skipped_completed', 'item_id', p_item_id);
  end if;

  if v_item.due_at > p_now
    and (v_item.next_attempt_at is null or v_item.next_attempt_at > p_now)
  then
    return jsonb_build_object('outcome', 'not_due', 'item_id', p_item_id);
  end if;

  if p_fail then
    v_attempt := v_item.attempt_count + 1;

    update hr_automation_items
    set attempt_count = v_attempt,
      last_attempt_at = p_now,
      next_attempt_at = case
        when v_attempt >= v_item.max_attempts then null
        else p_now + interval '5 minutes'
      end,
      status = case
        when v_attempt >= v_item.max_attempts then 'escalated'::hr_automation_item_status
        else 'failed'::hr_automation_item_status
      end,
      notification_level = case
        when v_attempt >= v_item.max_attempts then 'escalation'::hr_automation_notification_level
        else notification_level
      end,
      escalated_at = case
        when v_attempt >= v_item.max_attempts then coalesce(escalated_at, p_now)
        else escalated_at
      end,
      error_message = left(coalesce(p_error_message, 'automation handler failed'), 1000)
    where id = p_item_id
      and tenant_id = p_tenant_id;

    v_event_key := p_item_id::text || ':failure:' || v_attempt::text;
    insert into hr_automation_events (
      tenant_id,
      automation_item_id,
      event_key,
      event_type,
      notification_level,
      attempt,
      metadata
    )
    values (
      p_tenant_id,
      p_item_id,
      v_event_key,
      'automation.item_failed',
      case
        when v_attempt >= v_item.max_attempts then 'escalation'::hr_automation_notification_level
        else v_item.notification_level
      end,
      v_attempt,
      coalesce(p_event_context, '{}'::jsonb)
    )
    on conflict (tenant_id, event_key) do nothing;

    if v_attempt >= v_item.max_attempts then
      v_event_key := p_item_id::text || ':escalation';
      insert into hr_automation_events (
        tenant_id,
        automation_item_id,
        event_key,
        event_type,
        notification_level,
        attempt,
        metadata
      )
      values (
        p_tenant_id,
        p_item_id,
        v_event_key,
        'automation.item_escalated',
        'escalation',
        v_attempt,
        coalesce(p_event_context, '{}'::jsonb)
      )
      on conflict (tenant_id, event_key) do nothing;

      insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
      values (p_tenant_id, '00000000-0000-0000-0000-000000000000', 'automation.item_escalated', p_item_id);

      return jsonb_build_object('outcome', 'failed_escalated', 'item_id', p_item_id, 'attempt', v_attempt);
    end if;

    return jsonb_build_object('outcome', 'failed_retry_scheduled', 'item_id', p_item_id, 'attempt', v_attempt);
  end if;

  if v_item.reminder_stage = 0 then
    update hr_automation_items
    set status = 'due',
      notification_level = 'routine_reminder',
      reminder_stage = 1,
      last_reminded_at = p_now,
      last_attempt_at = p_now,
      next_attempt_at = null,
      error_message = null
    where id = p_item_id
      and tenant_id = p_tenant_id;

    v_event_key := p_item_id::text || ':routine_reminder:1';
    insert into hr_automation_events (
      tenant_id,
      automation_item_id,
      event_key,
      event_type,
      notification_level,
      attempt,
      metadata
    )
    values (
      p_tenant_id,
      p_item_id,
      v_event_key,
      'automation.routine_reminder',
      'routine_reminder',
      1,
      coalesce(p_event_context, '{}'::jsonb)
    )
    on conflict (tenant_id, event_key) do nothing;

    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    values (p_tenant_id, '00000000-0000-0000-0000-000000000000', 'automation.routine_reminder', p_item_id);
  else
    update hr_automation_items
    set status = 'due',
      last_attempt_at = p_now,
      next_attempt_at = null
    where id = p_item_id
      and tenant_id = p_tenant_id;
  end if;

  if p_complete then
    update hr_automation_items
    set status = 'completed',
      completed_at = coalesce(completed_at, p_now),
      completion_key = coalesce(completion_key, p_item_id::text || ':completed'),
      next_attempt_at = null,
      error_message = null
    where id = p_item_id
      and tenant_id = p_tenant_id;

    v_event_key := p_item_id::text || ':completed';
    insert into hr_automation_events (
      tenant_id,
      automation_item_id,
      event_key,
      event_type,
      notification_level,
      attempt,
      metadata
    )
    values (
      p_tenant_id,
      p_item_id,
      v_event_key,
      'automation.item_completed',
      'background',
      0,
      coalesce(p_event_context, '{}'::jsonb)
    )
    on conflict (tenant_id, event_key) do nothing;

    insert into audit_logs (tenant_id, actor_user_id, action_type, target_id)
    select p_tenant_id, '00000000-0000-0000-0000-000000000000', 'automation.item_completed', p_item_id
    where not exists (
      select 1
      from audit_logs
      where tenant_id = p_tenant_id
        and action_type = 'automation.item_completed'
        and target_id = p_item_id
    );

    if p_next_recurrence_idempotency_key is not null and p_next_due_at is not null then
      insert into hr_automation_items (
        tenant_id,
        rule_key,
        idempotency_key,
        subject_type,
        subject_id,
        owner_employee_id,
        due_at,
        notification_level,
        recurrence_key,
        metadata,
        max_attempts
      )
      values (
        p_tenant_id,
        v_item.rule_key,
        p_next_recurrence_idempotency_key,
        v_item.subject_type,
        v_item.subject_id,
        v_item.owner_employee_id,
        p_next_due_at,
        'background',
        coalesce(v_item.recurrence_key, v_item.idempotency_key),
        v_item.metadata,
        v_item.max_attempts
      )
      on conflict (tenant_id, rule_key, idempotency_key)
      do update set updated_at = clock_timestamp()
      returning id into v_next_id;
    end if;

    return jsonb_build_object(
      'outcome', 'completed',
      'item_id', p_item_id,
      'next_item_id', v_next_id
    );
  end if;

  return jsonb_build_object('outcome', 'reminder_recorded', 'item_id', p_item_id);
end;
$$;

revoke all on function teamframe_ensure_hr_automation_item(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  hr_automation_notification_level,
  text,
  jsonb,
  integer
) from public, anon, authenticated;
grant execute on function teamframe_ensure_hr_automation_item(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  hr_automation_notification_level,
  text,
  jsonb,
  integer
) to service_role;

revoke all on function teamframe_run_hr_automation_item(
  uuid,
  uuid,
  timestamptz,
  boolean,
  boolean,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function teamframe_run_hr_automation_item(
  uuid,
  uuid,
  timestamptz,
  boolean,
  boolean,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;
