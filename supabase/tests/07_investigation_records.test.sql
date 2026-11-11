-- Modèle métier d'enquête : provenance, isolation RLS et revue sous contrôle serveur.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'inv-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'inv-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'inv-c@test.local');

create temp table ctx as
select (select id from public.workspaces where owner_id = '00000000-0000-0000-0000-00000000000a') as ws;

insert into public.notebooks (id, workspace_id, created_by, title)
select '22222222-2222-2222-2222-222222222222', ws, '00000000-0000-0000-0000-00000000000a', 'Dossier A' from ctx;
insert into public.notebooks (id, workspace_id, created_by, title)
select '33333333-3333-3333-3333-333333333333', ws, '00000000-0000-0000-0000-00000000000a', 'Dossier B' from ctx;
insert into public.notebook_members (notebook_id, user_id, role)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b', 'viewer');

create temp table src as
select public.add_source(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-00000000000a',
  'txt', 'Compte rendu'
) as id;
update public.sources set status = 'ready' where id = (select id from src);

insert into public.investigation_entities
  (workspace_id, notebook_id, source_id, entity_type, label, context_excerpt, created_by)
select ctx.ws, '22222222-2222-2222-2222-222222222222', src.id, 'person', 'Personne mentionnée',
       'La source mentionne cette personne.', '00000000-0000-0000-0000-00000000000a'
from ctx, src;
insert into public.investigation_events
  (workspace_id, notebook_id, source_id, title, description, original_date_text, date_precision, context_excerpt, created_by)
select ctx.ws, '22222222-2222-2222-2222-222222222222', src.id, 'Dernière observation rapportée',
       'Événement consigné dans le rapport.', 'vers le 12 juin', 'approximate',
       'Le témoin situe l’observation vers le 12 juin.', '00000000-0000-0000-0000-00000000000a'
from ctx, src;
insert into public.investigation_statements
  (workspace_id, notebook_id, source_id, statement_type, content, context_excerpt, created_by)
select ctx.ws, '22222222-2222-2222-2222-222222222222', src.id, 'testimony',
       'Le témoin rapporte une observation.', 'Extrait exact du témoignage.',
       '00000000-0000-0000-0000-00000000000a'
from ctx, src;
insert into public.investigation_leads
  (workspace_id, notebook_id, source_id, title, verification_question, supporting_excerpt, next_check, created_by)
select ctx.ws, '22222222-2222-2222-2222-222222222222', src.id, 'Vérifier une indication',
       'Cette indication est-elle corroborée ?', 'Extrait motivant la question.',
       'Comparer avec une autre pièce autorisée.', '00000000-0000-0000-0000-00000000000a'
from ctx, src;

create or replace function pg_temp.login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is(
  (select (select count(*) from public.investigation_entities)
        + (select count(*) from public.investigation_events)
        + (select count(*) from public.investigation_statements)
        + (select count(*) from public.investigation_leads))::int,
  4, 'le propriétaire voit les quatre catégories du dossier'
);
select throws_ok(
  $$ insert into public.investigation_entities (workspace_id, notebook_id, source_id, entity_type, label, context_excerpt)
     select ws, '22222222-2222-2222-2222-222222222222', (select id from src), 'person', 'Intrusion', 'Extrait' from ctx $$,
  '42501', null, 'un utilisateur authentifié ne peut pas écrire directement'
);
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.investigation_leads), 1, 'un lecteur autorisé peut consulter les pistes');
reset role;

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.investigation_entities), 0, 'un utilisateur extérieur ne voit aucune entité');
reset role;

select throws_ok(
  $$ insert into public.investigation_entities (workspace_id, notebook_id, source_id, entity_type, label, context_excerpt)
     select ws, '33333333-3333-3333-3333-333333333333', (select id from src), 'person', 'Mauvais rattachement', 'Extrait' from ctx $$,
  '23503', null, 'une source ne peut pas être rattachée à un autre dossier'
);

select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public'
      and tablename in ('investigation_entities','investigation_events','investigation_statements','investigation_leads')
      and rowsecurity),
  4, 'RLS est activée sur toutes les tables métier'
);

select * from finish();
rollback;
