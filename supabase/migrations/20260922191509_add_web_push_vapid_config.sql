-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922191509 add_web_push_vapid_config
-- Do not manually rerun against the current live project.

create table if not exists public.push_vapid_config (
  singleton boolean primary key default true check (singleton),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_vapid_config enable row level security;

revoke all on table public.push_vapid_config from public;
revoke all on table public.push_vapid_config from anon;
revoke all on table public.push_vapid_config from authenticated;
grant select, insert, update on table public.push_vapid_config to service_role;

drop function if exists public.web_push_vapid_private_key();

comment on table public.push_vapid_config is
  'Server-only BFStaff VAPID keypair. Generated lazily by the push Edge Function; never expose private_key to clients.';
