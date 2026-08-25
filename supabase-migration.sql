-- lypo database migration.
--
-- Safe to run as many times as you like: every statement is guarded, and
-- policies are dropped before being recreated because create policy errors
-- rather than no-opping when the policy already exists.

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

drop policy if exists "owners read own versions" on project_versions;
create policy "owners read own versions" on project_versions
  for select using (
    exists (
      select 1 from projects
      where projects.id = project_versions.project_id
        and projects.user_id = auth.uid()
    )
  );

drop policy if exists "owners insert own versions" on project_versions;
create policy "owners insert own versions" on project_versions
  for insert with check (
    exists (
      select 1 from projects
      where projects.id = project_versions.project_id
        and projects.user_id = auth.uid()
    )
  );

drop policy if exists "owners delete own versions" on project_versions;
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

drop policy if exists "owners read own views" on site_views;
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

-- ---------- service_role table access ----------
-- On this project service_role has no table privileges, so anything using
-- the service key fails with "permission denied for table projects". That
-- is not only the admin pages: the weekly digest cron uses the same client,
-- so it has been failing silently.
--
-- service_role is the backend role. It bypasses RLS by design and its key is
-- server-only, never sent to a browser. These grants restore what a Supabase
-- project normally starts with.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- So tables added later are reachable too, without repeating this.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

-- ---------- saving one page without clobbering the others ----------
-- Extra pages are generated concurrently, and each request used to read the
-- whole pages object, add its own key, and write the whole thing back. Three
-- pages finishing at once meant two of them were silently lost: last write
-- wins. Same for the chat history.
--
-- This merges a single page in one statement, under a row lock, so
-- concurrent saves queue instead of overwriting each other.
--
-- SECURITY INVOKER (the default) on purpose: row level security still
-- applies, so this can only ever touch a project the caller owns.
create or replace function save_project_page(
  pid uuid,
  page_name text,
  page_html text,
  new_turns jsonb default '[]'::jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  merged jsonb;
  total integer;
begin
  -- Locks the row for the rest of the transaction, so a concurrent save of
  -- another page waits here rather than reading a stale copy.
  select coalesce(messages, '[]'::jsonb) || coalesce(new_turns, '[]'::jsonb)
    into merged
    from projects
   where id = pid
   for update;

  if merged is null then
    return; -- no such project, or not visible to this caller under RLS
  end if;

  -- Keep the newest 400 turns so one row cannot grow without bound.
  total := jsonb_array_length(merged);
  if total > 400 then
    select coalesce(jsonb_agg(e ORDER BY i), '[]'::jsonb)
      into merged
      from jsonb_array_elements(merged) with ordinality AS t(e, i)
     where i > total - 400;
  end if;

  update projects
     set pages = coalesce(pages, '{}'::jsonb)
                 || jsonb_build_object(page_name, page_html),
         html = case when page_name = 'home' then page_html else html end,
         messages = merged,
         updated_at = now()
   where id = pid;
end;
$$;

grant execute on function save_project_page(uuid, text, text, jsonb) to authenticated;

-- ---------- bring your own domain ----------
-- Read by the published-site renderer but never created, so custom domains
-- silently 404'd. The unique index matters as much as the column: two sites
-- claiming one domain has no sensible resolution, and the renderer fetches
-- with maybeSingle().
alter table projects add column if not exists custom_domain text;

create unique index if not exists projects_custom_domain_key
  on projects (custom_domain) where custom_domain is not null;

-- ---------- admin: featured sites ----------
-- The gallery is hand-written mockups. This lets a real published site be
-- shown there instead, which is far more convincing than an illustration.
alter table projects add column if not exists featured boolean not null default false;

-- ---------- admin: extra build allowance ----------
-- Granting one account more sites this month without making them an admin,
-- for a nonprofit or a class that legitimately needs more than five.
create table if not exists project_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  extra_projects integer not null default 0,
  note text,
  updated_at timestamptz not null default now()
);

alter table project_grants enable row level security;

-- Readable by the account it belongs to so the dashboard can show the
-- larger allowance. Only the service role writes, which is how the admin
-- pages reach it; no client-side policy grants insert or update.
drop policy if exists "read own grant" on project_grants;
create policy "read own grant" on project_grants
  for select using (user_id = auth.uid());

-- ---------- one site per address ----------
-- The published slug is the site's public address. It was only ever checked
-- in application code, so two publishes racing each other could both pass
-- the check and write the same slug. Two rows sharing a slug breaks the site
-- outright: the public page fetches with .single(), which errors when more
-- than one row matches. Only the database can actually guarantee this.
--
-- Unpublished projects have a null slug, and nulls do not collide, so the
-- index is partial.
--
-- If this errors with "could not create unique index", duplicates already
-- exist. Find them with:
--   select slug, count(*) from projects
--   where slug is not null group by slug having count(*) > 1;
create unique index if not exists projects_slug_key
  on projects (slug) where slug is not null;

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

-- Dropped first so this whole section can be re-run safely; create policy
-- errors rather than no-opping when the policy is already there.
drop policy if exists "owners read own events" on site_events;
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

-- ---------------------------------------------------------------------------
-- The design choice made during onboarding: which template, which color(s).
--
-- Stored on the project so that every later edit rebuilds the same design
-- brief. Without it, asking to change a phone number six weeks later would
-- regenerate the page against a default palette.
-- ---------------------------------------------------------------------------
alter table projects add column if not exists design jsonb;

-- ---------------------------------------------------------------------------
-- Whether this site may connect a domain of its own.
--
-- Off by default and granted per site from the admin board. Every custom
-- domain is a real domain registered against the Vercel project, so how many
-- exist is worth deciding rather than letting it happen.
-- ---------------------------------------------------------------------------
alter table projects
  add column if not exists custom_domain_allowed boolean not null default false;
