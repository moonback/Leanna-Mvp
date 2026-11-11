-- Catalogue global de publications publiques et synchronisation RSS incrémentale.
create table public.missing_person_notice_catalog (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (source_name in ('116000','arpd')),
  source_item_id text not null check (char_length(source_item_id) between 1 and 500),
  source_url text not null check (source_url ~ '^https://'),
  title text not null check (char_length(title) between 1 and 500),
  excerpt text check (excerpt is null or char_length(excerpt) <= 3000),
  published_at timestamptz,
  content_hash text not null check (char_length(content_hash) = 64),
  publication_status text not null default 'active'
    check (publication_status in ('active','changed','removed','unavailable')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name, source_item_id)
);
create index missing_person_notice_catalog_recent_idx
  on public.missing_person_notice_catalog(source_name, published_at desc nulls last, last_seen_at desc);

alter table public.missing_person_notices
  add column catalog_id uuid references public.missing_person_notice_catalog(id) on delete set null;
create unique index missing_person_notices_catalog_uidx
  on public.missing_person_notices(notebook_id, catalog_id) where catalog_id is not null;

create table public.missing_person_notice_sync_state (
  source_name text primary key check (source_name in ('116000','arpd')),
  feed_url text not null check (feed_url ~ '^https://'),
  enabled boolean not null default false,
  next_sync_at timestamptz not null default now(),
  lease_until timestamptz,
  etag text,
  last_modified text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_status text,
  last_error text,
  items_seen integer not null default 0 check (items_seen >= 0),
  updated_at timestamptz not null default now()
);
insert into public.missing_person_notice_sync_state(source_name, feed_url, enabled)
values ('116000', 'https://www.116000enfantsdisparus.fr/feed/', true),
       ('arpd', 'https://www.arpd.fr/feed/', false)
on conflict (source_name) do nothing;

alter table public.missing_person_notice_catalog enable row level security;
alter table public.missing_person_notice_sync_state enable row level security;
create policy missing_person_notice_catalog_read on public.missing_person_notice_catalog
  for select to authenticated using (true);
revoke insert, update, delete, truncate on public.missing_person_notice_catalog from anon, authenticated;
revoke all on public.missing_person_notice_sync_state from anon, authenticated;
grant select on public.missing_person_notice_catalog to authenticated;
grant all on public.missing_person_notice_catalog, public.missing_person_notice_sync_state to service_role;

create or replace function private.claim_missing_person_notice_sync(p_source text, p_lease_seconds integer default 90)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare affected integer;
begin
  update public.missing_person_notice_sync_state
  set lease_until = now() + make_interval(secs => greatest(15, least(p_lease_seconds, 300))),
      last_attempt_at = now(), updated_at = now()
  where source_name = p_source and enabled = true and next_sync_at <= now()
    and (lease_until is null or lease_until < now());
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function private.claim_missing_person_notice_sync(text, integer) from public, anon, authenticated;
grant execute on function private.claim_missing_person_notice_sync(text, integer) to service_role;
