-- Graphe d'enquête : isolation, provenance, relations, contradictions et filiation acyclique.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000001a', 'graph-owner@test.local'),
  ('00000000-0000-0000-0000-00000000001b', 'graph-outsider@test.local');

create temp table graph_ctx as
select (select id from public.workspaces where owner_id = '00000000-0000-0000-0000-00000000001a') as ws;
grant select on graph_ctx to authenticated, service_role;

insert into public.notebooks (id, workspace_id, created_by, title)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ws,
       '00000000-0000-0000-0000-00000000001a', 'Dossier graphe'
from graph_ctx;

create temp table graph_src_a as
select public.add_source(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-00000000001a',
  'txt', 'Rapport original'
) as id;
create temp table graph_src_b as
select public.add_source(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-00000000001a',
  'txt', 'Copie du rapport'
) as id;
grant select on graph_src_a, graph_src_b to authenticated, service_role;
update public.sources set status = 'ready', extracted_text = case
  when id = (select id from graph_src_a) then 'Le témoin indique : la personne était au lieu A.'
  when id = (select id from graph_src_b) then 'Un second témoin indique : la personne était au lieu B.'
  else extracted_text end
where id in ((select id from graph_src_a), (select id from graph_src_b));

insert into public.investigation_entities
  (workspace_id, notebook_id, source_id, entity_type, label, context_excerpt, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', graph_src_a.id,
       'person', 'Personne A', 'Le rapport mentionne Personne A.', '00000000-0000-0000-0000-00000000001a'
from graph_ctx, graph_src_a;
insert into public.investigation_entities
  (workspace_id, notebook_id, source_id, entity_type, label, context_excerpt, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', graph_src_b.id,
       'place', 'Lieu B', 'Le rapport mentionne Lieu B.', '00000000-0000-0000-0000-00000000001a'
from graph_ctx, graph_src_b;

insert into public.investigation_entity_clusters
  (workspace_id, notebook_id, entity_type, canonical_label, status, created_by)
select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'person', 'Personne A', 'candidate',
       '00000000-0000-0000-0000-00000000001a' from graph_ctx;
insert into public.investigation_entity_clusters
  (workspace_id, notebook_id, entity_type, canonical_label, status, created_by)
select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'place', 'Lieu B', 'candidate',
       '00000000-0000-0000-0000-00000000001a' from graph_ctx;

insert into public.investigation_entity_mentions
  (workspace_id, notebook_id, entity_id, cluster_id, match_status, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', e.id, c.id, 'candidate',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx
join public.investigation_entities e on e.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and e.label = 'Personne A'
join public.investigation_entity_clusters c on c.notebook_id = e.notebook_id and c.canonical_label = 'Personne A';
insert into public.investigation_entity_mentions
  (workspace_id, notebook_id, entity_id, cluster_id, match_status, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', e.id, c.id, 'candidate',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx
join public.investigation_entities e on e.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and e.label = 'Lieu B'
join public.investigation_entity_clusters c on c.notebook_id = e.notebook_id and c.canonical_label = 'Lieu B';

insert into public.investigation_statements
  (workspace_id, notebook_id, source_id, statement_type, content, context_excerpt, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', graph_src_a.id,
       'testimony', 'La personne était au lieu A.', 'Le témoin indique : la personne était au lieu A.',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx, graph_src_a;
insert into public.investigation_statements
  (workspace_id, notebook_id, source_id, statement_type, content, context_excerpt, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', graph_src_b.id,
       'testimony', 'La personne était au lieu B.', 'Un second témoin indique : la personne était au lieu B.',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx, graph_src_b;

insert into public.investigation_relations
  (workspace_id, notebook_id, subject_cluster_id, object_cluster_id, relation_type, status, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', a.id, b.id, 'seen_at', 'proposed',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx
join public.investigation_entity_clusters a on a.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and a.canonical_label = 'Personne A'
join public.investigation_entity_clusters b on b.notebook_id = a.notebook_id and b.canonical_label = 'Lieu B';

insert into public.investigation_relation_evidence
  (workspace_id, notebook_id, relation_id, source_id, evidence_role, quote, quote_hash, statement_id)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r.id, s.source_id, 'support',
       s.context_excerpt, encode(sha256(convert_to(s.context_excerpt, 'UTF8')), 'hex'), s.id
from graph_ctx
join public.investigation_relations r on r.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
join public.investigation_statements s on s.notebook_id = r.notebook_id
where s.source_id = (select id from graph_src_a);

select throws_ok(
  $ insert into public.investigation_relation_evidence
       (workspace_id, notebook_id, relation_id, source_id, evidence_role, quote, quote_hash, statement_id)
     select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r.id, (select id from graph_src_b),
       'support', 'Un second témoin indique : la personne était au lieu B.',
       encode(sha256(convert_to('Un second témoin indique : la personne était au lieu B.', 'UTF8')), 'hex'),
       s.id
     from graph_ctx
     join public.investigation_relations r on r.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     join public.investigation_statements s on s.notebook_id = r.notebook_id
     where s.source_id = (select id from graph_src_a) $,
  '23514', 'evidence_source_mismatch', 'une preuve ne peut pas citer une déclaration issue d une autre source'
);
select throws_ok(
  $ insert into public.investigation_relation_evidence
       (workspace_id, notebook_id, relation_id, source_id, evidence_role, quote, quote_hash)
     select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', r.id, (select id from graph_src_a),
       'support', 'Citation absente de la pièce.',
       encode(sha256(convert_to('Citation absente de la pièce.', 'UTF8')), 'hex')
     from graph_ctx
     join public.investigation_relations r on r.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $,
  '23514', 'evidence_quote_not_found', 'une citation absente du texte source est refusée'
);

insert into public.investigation_source_lineage
  (workspace_id, notebook_id, parent_source_id, child_source_id, lineage_type, created_by)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', graph_src_a.id, graph_src_b.id, 'copy',
       '00000000-0000-0000-0000-00000000001a'
from graph_ctx, graph_src_a, graph_src_b;

insert into public.investigation_contradictions
  (workspace_id, notebook_id, title, description, status, created_by)
select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Deux lieux rapportés',
       'Les déclarations situent la personne dans deux lieux différents à une période comparable.',
       'proposed', '00000000-0000-0000-0000-00000000001a'
from graph_ctx;
insert into public.investigation_contradiction_evidence
  (workspace_id, notebook_id, contradiction_id, statement_id, source_id, position, quote, quote_hash)
select graph_ctx.ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', c.id, s.id, s.source_id,
       'conflicts', s.context_excerpt, encode(sha256(convert_to(s.context_excerpt, 'UTF8')), 'hex')
from graph_ctx
join public.investigation_contradictions c on c.notebook_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
join public.investigation_statements s on s.notebook_id = c.notebook_id;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000001a', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.investigation_entity_clusters), 2, 'les deux nœuds canoniques sont visibles au propriétaire');
select is((select count(*)::int from public.investigation_entity_mentions), 2, 'les mentions restent séparées des nœuds canoniques');
select is((select count(*)::int from public.investigation_relations), 1, 'la relation sourcée est visible');
select is((select count(*)::int from public.investigation_relation_evidence), 1, 'la provenance de la relation est visible');
select is((select count(*)::int from public.investigation_source_lineage), 1, 'la filiation documentaire est visible');
select is((select count(*)::int from public.investigation_contradiction_evidence), 2, 'les deux déclarations contradictoires sont conservées');
select throws_ok(
  $$ insert into public.investigation_entity_clusters (workspace_id, notebook_id, entity_type, canonical_label)
     select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'person', 'Ecriture interdite' from graph_ctx $$,
  '42501', null, 'un utilisateur authentifié ne peut pas écrire directement dans le graphe'
);
reset role;

select throws_ok(
  $$ insert into public.investigation_source_lineage (workspace_id, notebook_id, parent_source_id, child_source_id, lineage_type)
     select ws, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       (select id from graph_src_b), (select id from graph_src_a), 'copy' from graph_ctx $$,
  '23514', 'source_lineage_cycle', 'un cycle de filiation documentaire est refusé'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000001b', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.investigation_entity_clusters), 0, 'un utilisateur extérieur ne voit aucun nœud');
reset role;

select * from finish();
rollback;
