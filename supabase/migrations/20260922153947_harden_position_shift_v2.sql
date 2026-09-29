-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922153947 harden_position_shift_v2

revoke execute on function public.get_position_shift_workflow() from anon;
revoke execute on function public.set_position_shift_check(text,text,boolean) from anon;
revoke execute on function public.confirm_position_shift(text) from anon;

alter function private.position_label(public.staff_position)
  set search_path = public, private;

create index if not exists position_shift_states_opened_by_idx
  on public.position_shift_states(opened_by);

create index if not exists position_shift_states_closed_by_idx
  on public.position_shift_states(closed_by);
