-- Plan Highlighter: projects, saved templates and project files.
-- Every row and file belongs to one user, and only that user can see or change it.

create table if not exists public.projects (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  format integer not null default 1,
  scene jsonb not null,
  assets jsonb not null default '{}'::jsonb,
  narration_name text,
  thumb text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated on public.projects (owner_id, updated_at desc);

create table if not exists public.templates (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists templates_owner on public.templates (owner_id);

alter table public.projects enable row level security;
alter table public.templates enable row level security;

drop policy if exists "projects: owner only" on public.projects;
create policy "projects: owner only" on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "templates: owner only" on public.templates;
create policy "templates: owner only" on public.templates
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Photos and narration: a private bucket, files at <user id>/<project id>/<kind>
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "project files: owner only" on storage.objects;
create policy "project files: owner only" on storage.objects
  for all to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
