-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history:
-- 20260922185826 revoke_anon_create_handover_execute
--
-- Keep for source-of-truth. Do not manually rerun on the current live project.

revoke all on function public.create_handover(
  text,
  public.handover_category,
  public.note_priority
) from anon;
