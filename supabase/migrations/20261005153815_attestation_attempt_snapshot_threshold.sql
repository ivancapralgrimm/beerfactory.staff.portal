create or replace function public.submit_attestation_attempt(
  p_client_attempt_id uuid,
  p_category text,
  p_category_id text,
  p_total_questions smallint,
  p_correct_answers smallint,
  p_category_results jsonb,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_question_revisions jsonb default '[]'::jsonb,
  p_synced_from_offline boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_score smallint;
  v_current_pass_percent smallint;
  v_attempt_pass_percent integer;
  v_pass_percent smallint;
  v_passed boolean;
  v_existing public.quiz_attempts%rowtype;
  v_inserted public.quiz_attempts%rowtype;
begin
  if v_user is null or not exists(
    select 1 from public.profiles p
    where p.id = v_user and p.is_active is true
  ) then raise exception 'forbidden'; end if;

  if p_client_attempt_id is null
     or p_total_questions < 1
     or p_correct_answers < 0
     or p_correct_answers > p_total_questions
     or p_category_id is null
     or length(btrim(p_category_id)) < 1 then
    raise exception 'attestation_attempt_invalid';
  end if;

  select * into v_existing
  from public.quiz_attempts
  where user_id = v_user and client_attempt_id = p_client_attempt_id
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'id',v_existing.id,'score',v_existing.score,'passed',v_existing.passed);
  end if;

  select pass_percent into v_current_pass_percent
  from public.attestation_settings where singleton is true;

  begin
    v_attempt_pass_percent := nullif(btrim(coalesce(p_category_results->>'pass_percent','')),'')::integer;
  exception when others then
    v_attempt_pass_percent := null;
  end;

  if v_attempt_pass_percent between 50 and 100 then
    v_pass_percent := v_attempt_pass_percent::smallint;
  else
    v_pass_percent := coalesce(v_current_pass_percent,80);
  end if;

  v_score := round((p_correct_answers::numeric * 100) / p_total_questions::numeric)::smallint;
  v_passed := v_score >= v_pass_percent;

  insert into public.quiz_attempts(
    user_id,category,category_id,score,passed,total_questions,correct_answers,
    category_results,started_at,finished_at,client_attempt_id,question_revisions,synced_from_offline
  ) values (
    v_user,nullif(btrim(coalesce(p_category,'')),''),btrim(p_category_id),v_score,v_passed,
    p_total_questions,p_correct_answers,
    coalesce(p_category_results,'{}'::jsonb) || jsonb_build_object('pass_percent',v_pass_percent),
    p_started_at,p_finished_at,p_client_attempt_id,coalesce(p_question_revisions,'[]'::jsonb),
    coalesce(p_synced_from_offline,false)
  ) returning * into v_inserted;

  return jsonb_build_object('ok',true,'duplicate',false,'id',v_inserted.id,'score',v_inserted.score,'passed',v_inserted.passed,'pass_percent',v_pass_percent);
end;
$$;

revoke all on function public.submit_attestation_attempt(uuid,text,text,smallint,smallint,jsonb,timestamptz,timestamptz,jsonb,boolean) from public, anon;
grant execute on function public.submit_attestation_attempt(uuid,text,text,smallint,smallint,jsonb,timestamptz,timestamptz,jsonb,boolean) to authenticated;
