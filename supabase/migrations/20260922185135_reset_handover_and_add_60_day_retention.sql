-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history:
-- 20260922185135 reset_handover_and_add_60_day_retention
--
-- This migration intentionally cleared the pre-r40.4 Handover notes once.
-- Keep for source-of-truth. Do not manually rerun on the current live project.

create extension if not exists pg_cron
  with schema extensions;

delete from public.notes;

create or replace function private.cleanup_handover_history()
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_deleted integer;
begin
  delete from public.notes
  where created_at <
    now() - interval '60 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function
  private.cleanup_handover_history()
  from public;

revoke all on function
  private.cleanup_handover_history()
  from anon;

revoke all on function
  private.cleanup_handover_history()
  from authenticated;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname =
      'beerfactory-handover-retention'
  ) then
    perform cron.unschedule(
      'beerfactory-handover-retention'
    );
  end if;

  perform cron.schedule(
    'beerfactory-handover-retention',
    '15 3 1 * *',
    'select private.cleanup_handover_history();'
  );
end;
$$;
