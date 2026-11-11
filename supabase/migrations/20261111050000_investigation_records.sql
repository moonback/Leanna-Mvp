-- Socle métier des dossiers d'enquête : toutes les informations restent rattachées
-- à une source du même dossier. Les écritures passent par les Route Handlers après
-- requireRole ; les clients ne disposent que de SELECT sous RLS.
alter table public.notebooks add constraint notebooks_workspace_id_id_unique unique (workspace_id, id);
alter table public.sources add constraint sources_id_notebook_unique unique (id, notebook_id);

alter type public.job_kind add value if not exists 'investigation_extract';

alter table public.investigation_entities
  add column origin text not null default 'manual' check (origin in ('manual','ai_extracted')),
  add column extraction_key text;
alter table public.investigation_events
  add column char_start integer check (char_start is null or char_start >= 0),
  add column char_end integer check (char_end is null or char_end > char_start),
  add column origin text not null default 'manual' check (origin in ('manual','ai_extracted')),
  add column extraction_key text;
alter table public.investigation_statements
  add column char_start integer check (char_start is null or char_start >= 0),
  add column char_end integer check (char_end is null or char_end > char_start),
  add column origin text not null default 'manual' check (origin in ('manual','ai_extracted')),
  add column extraction_key text;

create unique index investigation_entities_extraction_uq on public.investigation_entities(extraction_key);
create unique index investigation_events_extraction_uq on public.investigation_events(extraction_key) where extraction_key is not null;
create unique index investigation_statements_extraction_uq on public.investigation_statements(extraction_key) where extraction_key is not null;


create table public.investigation_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  source_id uuid not null,
  entity_type text not null check (entity_type in ('person','place','vehicle','object','organization')),
  label text not null check (char_length(label) between 1 and 240),
  context_excerpt text not null check (char_length(context_excerpt) between 1 and 4000),
  page_number integer check (page_number is null or page_number > 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end > char_start),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','under_review','verified','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade
);
create index investigation_entities_nb_idx on public.investigation_entities(notebook_id, entity_type, created_at desc);
create index investigation_entities_source_idx on public.investigation_entities(source_id);

create table public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  source_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  description text not null check (char_length(description) between 1 and 4000),
  original_date_text text not null check (char_length(original_date_text) between 1 and 160),
  occurred_at_start timestamptz,
  occurred_at_end timestamptz,
  date_precision text not null default 'unknown'
    check (date_precision in ('exact','approximate','range','unknown')),
  context_excerpt text not null check (char_length(context_excerpt) between 1 and 4000),
  page_number integer check (page_number is null or page_number > 0),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','under_review','verified','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (occurred_at_end is null or occurred_at_start is null or occurred_at_end >= occurred_at_start),
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade
);
create index investigation_events_nb_idx on public.investigation_events(notebook_id, occurred_at_start, created_at);
create index investigation_events_source_idx on public.investigation_events(source_id);

create table public.investigation_statements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  source_id uuid not null,
  statement_type text not null
    check (statement_type in ('documented_fact','testimony','unverified_information','hypothesis','contradiction')),
  content text not null check (char_length(content) between 1 and 5000),
  speaker_label text check (speaker_label is null or char_length(speaker_label) <= 240),
  recorded_at timestamptz,
  context_excerpt text not null check (char_length(context_excerpt) between 1 and 4000),
  page_number integer check (page_number is null or page_number > 0),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','under_review','verified','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade
);
create index investigation_statements_nb_idx on public.investigation_statements(notebook_id, statement_type, created_at desc);
create index investigation_statements_source_idx on public.investigation_statements(source_id);

create table public.investigation_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  source_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  verification_question text not null check (char_length(verification_question) between 1 and 3000),
  supporting_excerpt text not null check (char_length(supporting_excerpt) between 1 and 4000),
  counter_evidence text not null default '' check (char_length(counter_evidence) <= 4000),
  next_check text not null check (char_length(next_check) between 1 and 2000),
  confidence text not null default 'low' check (confidence in ('low','moderate','high')),
  status text not null default 'proposed'
    check (status in ('proposed','in_review','validated','rejected','closed')),
  page_number integer check (page_number is null or page_number > 0),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade
);
create index investigation_leads_nb_idx on public.investigation_leads(notebook_id, status, created_at desc);
create index investigation_leads_source_idx on public.investigation_leads(source_id);

create trigger touch_updated_at before update on public.investigation_entities
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.investigation_events
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.investigation_statements
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.investigation_leads
  for each row execute function private.touch_updated_at();

alter table public.investigation_entities enable row level security;
alter table public.investigation_events enable row level security;
alter table public.investigation_statements enable row level security;
alter table public.investigation_leads enable row level security;

create policy investigation_entities_read on public.investigation_entities for select to authenticated
  using (private.notebook_role(notebook_id) >= 'viewer');
create policy investigation_events_read on public.investigation_events for select to authenticated
  using (private.notebook_role(notebook_id) >= 'viewer');
create policy investigation_statements_read on public.investigation_statements for select to authenticated
  using (private.notebook_role(notebook_id) >= 'viewer');
create policy investigation_leads_read on public.investigation_leads for select to authenticated
  using (private.notebook_role(notebook_id) >= 'viewer');

revoke insert, update, delete, truncate on public.investigation_entities, public.investigation_events,
  public.investigation_statements, public.investigation_leads from anon, authenticated;
grant select on public.investigation_entities, public.investigation_events,
  public.investigation_statements, public.investigation_leads to authenticated;

grant all on public.investigation_entities, public.investigation_events,
  public.investigation_statements, public.investigation_leads to service_role;
