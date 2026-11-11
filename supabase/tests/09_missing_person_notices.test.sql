-- Avis publics : provenance, isolation par dossier et absence d'écriture directe côté client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000001a', 'notice-a@test.local'),
  ('00000000-0000-0000-0000-00000000001b', 'notice-b@test.local');

create temp table ctx as
select (select id from public.workspaces where owner_id = '00000000-0000-0000-0000-00000000001a') as ws;
grant select on ctx to authenticated, service_role;

insert into public.notebooks (id, workspace_id, created_by, title)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ws, '00000000-0000-0000-0000-00000000001a', 'Dossier avis A' from ctx;
insert into public.notebooks (id, workspace_id, created_by, title)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', ws, '00000000-0000-0000-0000-00000000001a', 'Dossier avis B' from ctx;

create temp table src as
select public.add_source(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-00000000001a',
  'txt', 'Avis original'
) as id;
grant select on src to authenticated, service_role;

set local role service_role;
insert into public.missing_person_notices
  (workspace_id, notebook_id, source_id, source_name, source_url, person_name, content_hash, created_by)
select ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', src.id, 'arpd',
       'https://www.arpd.fr/fr/recherche-disparition-accueil/avis-test',
       'Identité publiée', repeat('a', 64), '00000000-0000-0000-0000-00000000001a'
from ctx, src;
insert into public.missing_person_notice_revisions
  (workspace_id, notebook_id, notice_id, content_hash, snapshot, captured_by)
select n.workspace_id, n.notebook_id, n.id, n.content_hash,
       jsonb_build_object('source', 'arpd', 'personName', n.person_name),
       '00000000-0000-0000-0000-00000000001a'
from public.missing_person_notices n
where n.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
reset role;

select is((select count(*)::int from public.missing_person_notices), 1, 'la fiche d’avis est enregistrée');
select is((select count(*)::int from public.missing_person_notice_revisions), 1, 'un instantané de provenance est conservé');
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
    and tablename in ('missing_person_notices','missing_person_notice_revisions') and rowsecurity),
  2, 'RLS est activée sur les deux tables'
);

select throws_ok(
  $$ insert into public.missing_person_notices
     (workspace_id, notebook_id, source_id, source_name, source_url, person_name, content_hash)
     select ws, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', (select id from src), 'arpd',
            'https://www.arpd.fr/avis-test', 'Intrusion', repeat('b', 64) from ctx $$,
  '23503', null, 'une source ne peut pas être rattachée à un autre dossier'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000001a', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.missing_person_notices), 1, 'le propriétaire voit son avis');
select throws_ok(
  $$ insert into public.missing_person_notices
     (workspace_id, notebook_id, source_id, source_name, source_url, person_name, content_hash)
     select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (select id from src), 'arpd',
            'https://www.arpd.fr/avis-autre', 'Écriture interdite', repeat('c', 64) from ctx $$,
  '42501', null, 'un utilisateur authentifié ne peut pas écrire directement'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000001b', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.missing_person_notices), 0, 'un autre utilisateur ne voit pas les avis privés');
reset role;

select * from finish();
rollback;
