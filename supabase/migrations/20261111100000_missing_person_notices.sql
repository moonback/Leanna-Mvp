-- Registre d'avis de recherche publiés, rattachés à un dossier privé.
-- La collecte est volontairement manuelle dans cette première version : aucun scraping implicite.
create table public.missing_person_notices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  source_id uuid not null,
  source_name text not null check (source_name in ('arpd','116000','interpol')),
  source_url text not null check (char_length(source_url) between 12 and 2048),
  source_reference text check (source_reference is null or char_length(source_reference) <= 160),
  person_name text not null check (char_length(person_name) between 1 and 240),
  published_date_text text check (published_date_text is null or char_length(published_date_text) <= 160),
  disappearance_location text check (disappearance_location is null or char_length(disappearance_location) <= 500),
  published_summary text check (published_summary is null or char_length(published_summary) <= 5000),
  publication_status text not null default 'active'
    check (publication_status in ('active','changed','removed','unavailable')),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review','approved','rejected')),
  content_hash text not null check (char_length(content_hash) = 64),
  collected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id),
  unique (id, notebook_id),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade
);
create index missing_person_notices_notebook_idx
  on public.missing_person_notices(notebook_id, review_status, publication_status, created_at desc);
create index missing_person_notices_hash_idx
  on public.missing_person_notices(notebook_id, content_hash);

create table public.missing_person_notice_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  notice_id uuid not null,
  content_hash text not null check (char_length(content_hash) = 64),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users(id) on delete set null,
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (notice_id, notebook_id) references public.missing_person_notices(id, notebook_id) on delete cascade
);
create index missing_person_notice_revisions_notice_idx
  on public.missing_person_notice_revisions(notice_id, captured_at desc);

create trigger touch_updated_at before update on public.missing_person_notices
  for each row execute function private.touch_updated_at();

alter table public.missing_person_notices enable row level security;
alter table public.missing_person_notice_revisions enable row level security;
create policy missing_person_notices_read on public.missing_person_notices
  for select to authenticated using (private.notebook_role(notebook_id) >= 'viewer');
create policy missing_person_notice_revisions_read on public.missing_person_notice_revisions
  for select to authenticated using (private.notebook_role(notebook_id) >= 'viewer');
revoke insert, update, delete, truncate on public.missing_person_notices from anon, authenticated;
revoke insert, update, delete, truncate on public.missing_person_notice_revisions from anon, authenticated;
grant select on public.missing_person_notices, public.missing_person_notice_revisions to authenticated;
grant all on public.missing_person_notices, public.missing_person_notice_revisions to service_role;
