begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_table('public', 'missing_person_notice_catalog', 'le catalogue global existe');
select has_table('public', 'missing_person_notice_sync_state', 'la configuration de synchronisation existe');
select has_function('public', 'claim_missing_person_notice_sync', array['text','integer'], 'la fonction de bail du worker existe');
select is(
  (select enabled from public.missing_person_notice_sync_state where source_name = '116000'),
  true,
  'le flux 116000 est activé'
);
select is(
  (select enabled from public.missing_person_notice_sync_state where source_name = 'arpd'),
  false,
  'ARPD reste désactivé tant que son flux et ses conditions ne sont pas confirmés'
);

select * from finish();
rollback;
