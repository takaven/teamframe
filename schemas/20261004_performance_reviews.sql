-- Marketability Release M4 — lightweight, confidential performance reviews.
-- Bounded to templates, cycles, assigned reviews, comments/ratings, acknowledgement and reminders.

create table if not exists performance_review_templates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references companies(id) on delete restrict,
  name text not null, questions jsonb not null default '[]'::jsonb, rating_scale_max integer not null default 5,
  active boolean not null default true, created_by_user_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id, id), unique(tenant_id, name), check(char_length(name) between 1 and 120),
  check(jsonb_typeof(questions)='array'), check(rating_scale_max between 3 and 10)
);

create table if not exists performance_review_cycles (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references companies(id) on delete restrict,
  template_id uuid not null,
  name text not null, due_date date not null, status text not null default 'open',
  template_name_snapshot text not null, questions_snapshot jsonb not null, rating_scale_max_snapshot integer not null,
  self_input_enabled boolean not null default true,
  created_by_user_id uuid not null, created_at timestamptz not null default now(), closed_at timestamptz,
  constraint performance_review_cycles_template_fk foreign key(tenant_id,template_id)
    references performance_review_templates(tenant_id,id) on delete restrict,
  unique(tenant_id, id), unique(tenant_id, name), check(status in ('draft','open','closed')),
  check(jsonb_typeof(questions_snapshot)='array'), check(char_length(name) between 1 and 120)
);

create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references companies(id) on delete restrict,
  cycle_id uuid not null,
  employee_id uuid not null, reviewer_employee_id uuid not null,
  employee_responses jsonb not null default '{}'::jsonb, reviewer_responses jsonb not null default '{}'::jsonb,
  rating numeric(4,2), reviewer_comments text, status text not null default 'assigned',
  employee_submitted_at timestamptz, reviewer_completed_at timestamptz, acknowledged_at timestamptz,
  employee_reminder_sent_at timestamptz, reviewer_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint performance_reviews_employee_fk foreign key(tenant_id,employee_id) references employees(tenant_id,id) on delete restrict,
  constraint performance_reviews_reviewer_fk foreign key(tenant_id,reviewer_employee_id) references employees(tenant_id,id) on delete restrict,
  constraint performance_reviews_cycle_fk foreign key(tenant_id,cycle_id) references performance_review_cycles(tenant_id,id) on delete restrict,
  unique(cycle_id, employee_id), check(status in ('assigned','self_submitted','completed','acknowledged')),
  check(reviewer_comments is null or char_length(reviewer_comments)<=4000)
);
create index if not exists performance_reviews_actor_idx on performance_reviews(tenant_id,employee_id,reviewer_employee_id,status);

alter table performance_review_templates enable row level security;
alter table performance_review_cycles enable row level security;
alter table performance_reviews enable row level security;

drop policy if exists performance_review_templates_select on performance_review_templates;
create policy performance_review_templates_select on performance_review_templates for select
using (current_actor_has_profile(tenant_id,array['full_access'::access_profile]));
drop policy if exists performance_review_cycles_select on performance_review_cycles;
create policy performance_review_cycles_select on performance_review_cycles for select
using (tenant_id=current_actor_tenant_id());
drop policy if exists performance_reviews_select on performance_reviews;
create policy performance_reviews_select on performance_reviews for select using (
  current_actor_has_profile(tenant_id,array['full_access'::access_profile])
  or current_actor_employee_id(tenant_id) in (employee_id, reviewer_employee_id)
);
-- All mutations run through the server service after exact actor/state checks.
drop policy if exists performance_reviews_no_direct_write on performance_reviews;
create policy performance_reviews_no_direct_write on performance_reviews for all using(false) with check(false);
