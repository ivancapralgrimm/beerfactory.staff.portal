-- ALREADY APPLIED TO LIVE SUPABASE.
-- Migration history: 20260922191434 add_web_push_subscriptions
-- Do not manually rerun against the current live project.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_self_read on public.push_subscriptions;
create policy push_subscriptions_self_read
on public.push_subscriptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.current_role()) is not null
);

revoke all on table public.push_subscriptions from anon;
revoke all on table public.push_subscriptions from authenticated;
grant select on table public.push_subscriptions to authenticated;

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_endpoint text := trim(coalesce(p_endpoint, ''));
  v_p256dh text := trim(coalesce(p_p256dh, ''));
  v_auth text := trim(coalesce(p_auth, ''));
  result public.push_subscriptions;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  if v_endpoint = '' or v_p256dh = '' or v_auth = '' then
    raise exception 'invalid_push_subscription';
  end if;

  insert into public.push_subscriptions(
    user_id, endpoint, p256dh, auth, user_agent, updated_at, failure_count
  ) values(
    auth.uid(), v_endpoint, v_p256dh, v_auth,
    nullif(trim(coalesce(p_user_agent, '')), ''), now(), 0
  )
  on conflict (endpoint)
  do update set
    user_id = auth.uid(),
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now(),
    failure_count = 0
  returning * into result;

  return result;
end;
$$;

create or replace function public.unregister_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_deleted integer;
begin
  if private.current_role() is null then
    raise exception 'forbidden';
  end if;

  delete from public.push_subscriptions
  where endpoint = trim(coalesce(p_endpoint, ''))
    and user_id = auth.uid();

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.register_push_subscription(text,text,text,text) from public;
revoke all on function public.register_push_subscription(text,text,text,text) from anon;
grant execute on function public.register_push_subscription(text,text,text,text) to authenticated;

revoke all on function public.unregister_push_subscription(text) from public;
revoke all on function public.unregister_push_subscription(text) from anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;
