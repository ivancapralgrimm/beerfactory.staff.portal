-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922191810 normalize_web_push_metadata
-- Do not manually rerun against the current live project.

comment on table public.push_subscriptions is
  'Per-device BFStaff Web Push subscriptions. Client mutations are allowed only through auth-bound RPCs.';

comment on table public.push_vapid_config is
  'Server-only BFStaff VAPID keypair generated lazily by the handover-push Edge Function.';
