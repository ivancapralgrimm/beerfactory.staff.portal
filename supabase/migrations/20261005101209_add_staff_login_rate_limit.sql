create table if not exists private.login_rate_limits (
  key text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

revoke all on table private.login_rate_limits from public, anon, authenticated;

create or replace function public.login_rate_limit_allowed(
  p_fingerprint text,
  p_limit integer default 6
)
returns boolean
language plpgsql
security definer
set search_path = private, extensions, pg_temp
as $$
declare
  v_key text;
  v_attempts integer;
  v_started timestamptz;
  v_blocked_until timestamptz;
  v_now timestamptz := now();
begin
  if coalesce(trim(p_fingerprint), '') = '' then return false; end if;
  if p_limit < 1 or p_limit > 1000 then return false; end if;

  v_key := encode(extensions.digest(p_fingerprint, 'sha256'), 'hex');

  select attempts, window_started_at, blocked_until
    into v_attempts, v_started, v_blocked_until
  from private.login_rate_limits
  where key = v_key;

  if not found then return true; end if;
  if v_blocked_until is not null and v_blocked_until > v_now then return false; end if;
  if v_now - v_started >= interval '15 minutes' then return true; end if;

  return v_attempts < p_limit;
end;
$$;

create or replace function public.record_login_failure(
  p_fingerprint text,
  p_limit integer default 6
)
returns void
language plpgsql
security definer
set search_path = private, extensions, pg_temp
as $$
declare
  v_key text;
  v_attempts integer;
  v_started timestamptz;
  v_now timestamptz := now();
begin
  if coalesce(trim(p_fingerprint), '') = '' then return; end if;
  if p_limit < 1 or p_limit > 1000 then return; end if;

  v_key := encode(extensions.digest(p_fingerprint, 'sha256'), 'hex');

  select attempts, window_started_at
    into v_attempts, v_started
  from private.login_rate_limits
  where key = v_key
  for update;

  if not found then
    insert into private.login_rate_limits(
      key, attempts, window_started_at, blocked_until
    )
    values (
      v_key,
      1,
      v_now,
      case when p_limit <= 1 then v_now + interval '15 minutes' else null end
    );
    return;
  end if;

  if v_now - v_started >= interval '15 minutes' then
    update private.login_rate_limits
    set attempts = 1,
        window_started_at = v_now,
        blocked_until = case
          when p_limit <= 1 then v_now + interval '15 minutes'
          else null
        end
    where key = v_key;
    return;
  end if;

  update private.login_rate_limits
  set attempts = v_attempts + 1,
      blocked_until = case
        when v_attempts + 1 >= p_limit then v_now + interval '15 minutes'
        else blocked_until
      end
  where key = v_key;
end;
$$;

create or replace function public.clear_login_failures(
  p_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = private, extensions, pg_temp
as $$
begin
  if coalesce(trim(p_fingerprint), '') = '' then return; end if;

  delete from private.login_rate_limits
  where key = encode(extensions.digest(p_fingerprint, 'sha256'), 'hex');
end;
$$;

revoke all on function public.login_rate_limit_allowed(text, integer) from public, anon, authenticated;
revoke all on function public.record_login_failure(text, integer) from public, anon, authenticated;
revoke all on function public.clear_login_failures(text) from public, anon, authenticated;

grant execute on function public.login_rate_limit_allowed(text, integer) to service_role;
grant execute on function public.record_login_failure(text, integer) to service_role;
grant execute on function public.clear_login_failures(text) to service_role;
