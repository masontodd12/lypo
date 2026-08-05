-- lypo: version history + analytics
-- Run this once in the Supabase SQL editor.

-- ---------- version history ----------
create table if not exists project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  page text not null default 'home',
  html text not null,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists project_versions_project_idx
  on project_versions (project_id, page, created_at desc);

alter table project_versions enable row level security;

create policy "owners read own versions" on project_versions
  for select using (
    exists (
      select 1 from projects
      where projects.id = project_versions.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "owners insert own versions" on project_versions
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = project_versions.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "owners delete own versions" on project_versions
  for delete using (
    exists (
      select 1 from projects
      where projects.id = project_versions.project_id
        and projects.user_id = auth.uid()
    )
  );

-- ---------- brand logo ----------
-- Kept on the project so it survives a reload and keeps getting applied
-- to every later edit, not just the first build.
alter table projects add column if not exists logo_url text;

-- ---------- site analytics ----------
create table if not exists site_views (
  project_id uuid not null references projects(id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (project_id, day)
);

alter table site_views enable row level security;

create policy "owners read own views" on site_views
  for select using (
    exists (
      select 1 from projects
      where projects.id = site_views.project_id
        and projects.user_id = auth.uid()
    )
  );

-- Public sites bump the counter through this function, so no anon
-- write access to the table is ever needed.
create or replace function increment_site_view(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into site_views (project_id, day, count)
  values (pid, current_date, 1)
  on conflict (project_id, day)
  do update set count = site_views.count + 1;
end;
$$;

grant execute on function increment_site_view(uuid) to anon, authenticated;

-- ---------- onboarding draft ----------
-- The interview runs five to seven questions before anything is generated.
-- Without this the answers only lived in the browser, so closing the tab or
-- taking a call partway through threw all of it away.
alter table projects add column if not exists onboarding_draft jsonb;

-- ---------- what visitors actually did ----------
-- A view count alone does not tell an owner whether the site is working.
-- Taps on the phone number or the map link are the ones that mean someone
-- is about to walk in the door.
create table if not exists site_events (
  project_id uuid not null references projects(id) on delete cascade,
  day date not null default current_date,
  event text not null,
  count integer not null default 0,
  primary key (project_id, day, event)
);

alter table site_events enable row level security;

create policy "owners read own events" on site_events
  for select using (
    exists (
      select 1 from projects
      where projects.id = site_events.project_id
        and projects.user_id = auth.uid()
    )
  );

-- Same pattern as increment_site_view: public sites bump the counter through
-- this function, so anon never needs write access to the table.
create or replace function increment_site_event(pid uuid, ev text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fixed vocabulary, so a public caller cannot fill the table with junk.
  if ev not in ('call', 'directions', 'menu', 'social', 'pay') then
    return;
  end if;
  insert into site_events (project_id, day, event, count)
  values (pid, current_date, ev, 1)
  on conflict (project_id, day, event)
  do update set count = site_events.count + 1;
end;
$$;

grant execute on function increment_site_event(uuid, text) to anon, authenticated;
