-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history:
-- 20260922184713 add_react_handover_create_rpc_and_harden_grants
--
-- Keep for source-of-truth. Do not manually rerun on the current live project.

create or replace function public.create_handover(
  p_body text,
  p_category public.handover_category default 'other',
  p_priority public.note_priority default 'normal'
)
returns public.notes
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_context jsonb;
  v_shift_id uuid;
  result public.notes;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if length(v_body) < 1 then
    raise exception 'handover_body_required';
  end if;

  if length(v_body) > 2000 then
    raise exception 'handover_body_too_long';
  end if;

  v_context := private.shift_window_context();

  if v_context->>'window_state' = 'open' then
    select s.id
      into v_shift_id
    from public.shifts s
    where s.shift_date =
      (v_context->>'operational_date')::date
    limit 1;
  end if;

  insert into public.notes(
    shift_id,
    author_id,
    body,
    category,
    priority
  )
  values(
    v_shift_id,
    auth.uid(),
    v_body,
    p_category,
    p_priority
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_handover(
  text,
  public.handover_category,
  public.note_priority
) from public;

grant execute on function public.create_handover(
  text,
  public.handover_category,
  public.note_priority
) to authenticated;

revoke all on table public.notes from anon;

revoke delete, truncate, references, trigger
  on table public.notes
  from authenticated;

grant select on table public.notes
  to authenticated;
