-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922161749 add_hostess_staff_position

alter type public.staff_position
  add value if not exists 'hostess';
