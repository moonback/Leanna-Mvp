-- Graphe d'enquête : identités canoniques, mentions sourcées, relations et filiation documentaire.
-- Aucune fusion automatique d'homonymes : les rapprochements restent candidats jusqu'à revue humaine.

alter table public.investigation_entities
  add constraint investigation_entities_id_notebook_unique unique (id, notebook_id);
alter table public.investigation_events
  add constraint investigation_events_id_notebook_unique unique (id, notebook_id);
alter table public.investigation_statements
  add constraint investigation_statements_id_notebook_unique unique (id, notebook_id);

create table public.investigation_entity_clusters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  entity_type text not null check (entity_type in ('person','place','vehicle','object','organization')),
  canonical_label text not null check (char_length(canonical_label) between 1 and 240),
  status text not null default 'candidate'
    check (status in ('candidate','confirmed','merged','rejected')),
  merged_into_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, notebook_id),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (merged_into_id, notebook_id) references public.investigation_entity_clusters(id, notebook_id)
    on delete restrict,
  check (merged_into_id is null or merged_into_id <> id),
  check ((status = 'merged') = (merged_into_id is not null))
);
create index investigation_entity_clusters_nb_idx
  on public.investigation_entity_clusters(notebook_id, entity_type, status, canonical_label);

create table public.investigation_entity_mentions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  entity_id uuid not null,
  cluster_id uuid not null,
  match_status text not null default 'candidate'
    check (match_status in ('candidate','confirmed','rejected')),
  match_rationale text check (match_rationale is null or char_length(match_rationale) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_id),
  unique (id, notebook_id),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (entity_id, notebook_id) references public.investigation_entities(id, notebook_id) on delete cascade,
  foreign key (cluster_id, notebook_id) references public.investigation_entity_clusters(id, notebook_id) on delete cascade
);
create index investigation_entity_mentions_cluster_idx
  on public.investigation_entity_mentions(notebook_id, cluster_id, match_status);

create table public.investigation_source_lineage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  parent_source_id uuid not null,
  child_source_id uuid not null,
  lineage_type text not null check (lineage_type in ('copy','excerpt','translation','transcription','derived','unknown')),
  note text check (note is null or char_length(note) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (parent_source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (child_source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  check (parent_source_id <> child_source_id),
  unique (parent_source_id, child_source_id, lineage_type)
);
create index investigation_source_lineage_parent_idx
  on public.investigation_source_lineage(notebook_id, parent_source_id);
create index investigation_source_lineage_child_idx
  on public.investigation_source_lineage(notebook_id, child_source_id);

create function private.prevent_investigation_source_lineage_cycle()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  -- Sérialise les modifications de filiation par dossier pour empêcher deux insertions concurrentes de créer un cycle.
  perform pg_advisory_xact_lock(hashtext('investigation_source_lineage'), hashtext(new.notebook_id::text));
  if exists (
    with recursive reachable(source_id) as (
      select l.child_source_id
      from public.investigation_source_lineage l
      where l.notebook_id = new.notebook_id
        and l.parent_source_id = new.child_source_id
      union
      select l.child_source_id
      from public.investigation_source_lineage l
      join reachable r on r.source_id = l.parent_source_id
      where l.notebook_id = new.notebook_id
    )
    select 1 from reachable where source_id = new.parent_source_id
  ) then
    raise exception 'source_lineage_cycle' using errcode = '23514';
  end if;
  return new;
end;
$fn$;
revoke all on function private.prevent_investigation_source_lineage_cycle() from public, anon, authenticated;
create trigger investigation_source_lineage_no_cycle
  before insert or update of parent_source_id, child_source_id, notebook_id
  on public.investigation_source_lineage
  for each row execute function private.prevent_investigation_source_lineage_cycle();

create table public.investigation_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  subject_cluster_id uuid not null,
  object_cluster_id uuid not null,
  relation_type text not null check (relation_type in (
    'knows','reported_about','seen_at','located_at','travelled_in','owns','uses',
    'works_for','related_to','present_with','contacted','mentioned_with','other'
  )),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, notebook_id),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (subject_cluster_id, notebook_id) references public.investigation_entity_clusters(id, notebook_id) on delete cascade,
  foreign key (object_cluster_id, notebook_id) references public.investigation_entity_clusters(id, notebook_id) on delete cascade,
  check (subject_cluster_id <> object_cluster_id)
);
create index investigation_relations_subject_idx
  on public.investigation_relations(notebook_id, subject_cluster_id, status);
create index investigation_relations_object_idx
  on public.investigation_relations(notebook_id, object_cluster_id, status);

create table public.investigation_relation_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  relation_id uuid not null,
  source_id uuid not null,
  evidence_role text not null default 'support' check (evidence_role in ('support','contrary','context')),
  quote text not null check (char_length(quote) between 1 and 4000),
  quote_hash text not null,
  page_number integer check (page_number is null or page_number > 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end > char_start),
  statement_id uuid,
  event_id uuid,
  entity_mention_id uuid,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (relation_id, notebook_id) references public.investigation_relations(id, notebook_id) on delete cascade,
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  foreign key (statement_id, notebook_id) references public.investigation_statements(id, notebook_id) on delete cascade,
  foreign key (event_id, notebook_id) references public.investigation_events(id, notebook_id) on delete cascade,
  foreign key (entity_mention_id, notebook_id) references public.investigation_entity_mentions(id, notebook_id) on delete cascade,
  check ((char_start is null and char_end is null) or (char_start is not null and char_end is not null and char_end > char_start)),
  check (num_nonnulls(statement_id, event_id, entity_mention_id) <= 1),
  unique (relation_id, source_id, evidence_role, quote_hash)
);
create index investigation_relation_evidence_relation_idx
  on public.investigation_relation_evidence(notebook_id, relation_id);
create index investigation_relation_evidence_source_idx
  on public.investigation_relation_evidence(notebook_id, source_id);

create function private.validate_investigation_relation_evidence_provenance()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_source_id uuid;
  v_text text;
  v_context text;
begin
  if new.statement_id is not null then
    select source_id, context_excerpt into v_source_id, v_context
      from public.investigation_statements
      where id = new.statement_id and notebook_id = new.notebook_id;
  elsif new.event_id is not null then
    select source_id, context_excerpt into v_source_id, v_context
      from public.investigation_events
      where id = new.event_id and notebook_id = new.notebook_id;
  elsif new.entity_mention_id is not null then
    select e.source_id, e.context_excerpt into v_source_id, v_context
      from public.investigation_entities e
      join public.investigation_entity_mentions m on m.entity_id = e.id and m.notebook_id = e.notebook_id
      where m.id = new.entity_mention_id and m.notebook_id = new.notebook_id;
  end if;
  if v_source_id is not null and v_source_id <> new.source_id then
    raise exception 'evidence_source_mismatch' using errcode = '23514';
  end if;
  if v_context is not null and position(new.quote in v_context) = 0 then
    raise exception 'evidence_context_mismatch' using errcode = '23514';
  end if;
  select extracted_text into v_text from public.sources
    where id = new.source_id and notebook_id = new.notebook_id;
  if v_text is null or position(new.quote in v_text) = 0 then
    raise exception 'evidence_quote_not_found' using errcode = '23514';
  end if;
  if new.char_start is not null and substring(v_text from new.char_start + 1 for new.char_end - new.char_start) <> new.quote then
    raise exception 'evidence_offset_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$fn$;
revoke all on function private.validate_investigation_relation_evidence_provenance() from public, anon, authenticated;
create trigger investigation_relation_evidence_validate
  before insert or update on public.investigation_relation_evidence
  for each row execute function private.validate_investigation_relation_evidence_provenance();

create table public.investigation_contradictions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  description text not null check (char_length(description) between 1 and 3000),
  status text not null default 'proposed'
    check (status in ('proposed','under_review','resolved','rejected')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, notebook_id),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade
);
create index investigation_contradictions_nb_idx
  on public.investigation_contradictions(notebook_id, status, created_at desc);

create table public.investigation_contradiction_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  notebook_id uuid not null,
  contradiction_id uuid not null,
  statement_id uuid not null,
  source_id uuid not null,
  position text not null check (position in ('conflicts','qualifies','context')),
  quote text not null check (char_length(quote) between 1 and 4000),
  quote_hash text not null,
  page_number integer check (page_number is null or page_number > 0),
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end > char_start),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, notebook_id) references public.notebooks(workspace_id, id) on delete cascade,
  foreign key (contradiction_id, notebook_id) references public.investigation_contradictions(id, notebook_id) on delete cascade,
  foreign key (statement_id, notebook_id) references public.investigation_statements(id, notebook_id) on delete cascade,
  foreign key (source_id, notebook_id) references public.sources(id, notebook_id) on delete cascade,
  check ((char_start is null and char_end is null) or (char_start is not null and char_end is not null and char_end > char_start)),
  unique (contradiction_id, statement_id, position)
);
create index investigation_contradiction_evidence_idx
  on public.investigation_contradiction_evidence(notebook_id, contradiction_id);

create function private.validate_investigation_contradiction_evidence_provenance()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_source_id uuid;
  v_text text;
  v_context text;
begin
  select source_id, context_excerpt into v_source_id, v_context
    from public.investigation_statements
    where id = new.statement_id and notebook_id = new.notebook_id;
  if v_source_id is null or v_source_id <> new.source_id then
    raise exception 'evidence_source_mismatch' using errcode = '23514';
  end if;
  if v_context is null or position(new.quote in v_context) = 0 then
    raise exception 'evidence_context_mismatch' using errcode = '23514';
  end if;
  select extracted_text into v_text from public.sources
    where id = new.source_id and notebook_id = new.notebook_id;
  if v_text is null or position(new.quote in v_text) = 0 then
    raise exception 'evidence_quote_not_found' using errcode = '23514';
  end if;
  if new.char_start is not null and substring(v_text from new.char_start + 1 for new.char_end - new.char_start) <> new.quote then
    raise exception 'evidence_offset_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$fn$;
revoke all on function private.validate_investigation_contradiction_evidence_provenance() from public, anon, authenticated;
create trigger investigation_contradiction_evidence_validate
  before insert or update on public.investigation_contradiction_evidence
  for each row execute function private.validate_investigation_contradiction_evidence_provenance();

create trigger touch_updated_at before update on public.investigation_entity_clusters
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.investigation_relations
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.investigation_contradictions
  for each row execute function private.touch_updated_at();

do $do$
declare
  t text;
begin
  foreach t in array array[
    'investigation_entity_clusters','investigation_entity_mentions','investigation_source_lineage',
    'investigation_relations','investigation_relation_evidence','investigation_contradictions',
    'investigation_contradiction_evidence'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.notebook_role(notebook_id) >= ''viewer'')',
      t || '_read', t
    );
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$do$;
