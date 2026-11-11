-- Correctifs appliqués après 20261111050000 : mise en file idempotente du recoupement
-- et coûts de crédits par défaut. Ré-exécutable sans effet de bord.
create or replace function public.queue_investigation_crosscheck_job(p_notebook uuid, p_user uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_job uuid;
  v_usage uuid;
begin
  select workspace_id into v_ws from public.notebooks where id = p_notebook;
  if v_ws is null then raise exception 'notebook_not_found' using errcode = 'P0002'; end if;
  insert into public.jobs (workspace_id, notebook_id, user_id, kind, target_id, payload, idempotency_key)
    values (v_ws, p_notebook, p_user, 'investigation_crosscheck', null,
      jsonb_build_object('requested_by', p_user), p_idempotency_key)
    on conflict (idempotency_key) do nothing
    returning id into v_job;
  if v_job is null then
    select id into v_job from public.jobs where idempotency_key = p_idempotency_key;
    return v_job;
  end if;
  v_usage := public.reserve_usage(v_ws, p_user, 'investigation_crosscheck', v_job);
  update public.jobs set usage_id = v_usage where id = v_job;
  return v_job;
end $$;

revoke execute on function public.queue_investigation_crosscheck_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.queue_investigation_crosscheck_job(uuid, uuid, text) to service_role;

update public.plans
set limits = jsonb_set(
  limits,
  '{credit_cost}',
  coalesce(limits -> 'credit_cost', '{}'::jsonb)
    || '{"investigation_extract":1,"investigation_crosscheck":5}'::jsonb,
  true
),
updated_at = now();
