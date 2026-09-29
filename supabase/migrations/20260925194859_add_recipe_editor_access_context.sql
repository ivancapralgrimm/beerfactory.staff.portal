-- BeerFactory Staff Portal
-- New migration: add_recipe_editor_access_context
-- Applied to live Supabase on 2026-09-26.
-- Purpose: preserve restricted profile-directory column grants while allowing
-- the Worker to verify only the currently authenticated user's recipe-admin access.

create or replace function public.recipe_editor_access_context()
returns table (
  user_id uuid,
  display_name text,
  is_active boolean,
  can_manage_recipes boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id as user_id,
    coalesce(
      nullif(
        btrim(concat_ws(' ', p.first_name, p.last_name)),
        ''
      ),
      'Администратор'
    )::text as display_name,
    p.is_active,
    (
      p.is_active is true
      and (p.role::text = 'admin' or p.is_owner is true)
    ) as can_manage_recipes
  from public.profiles as p
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.recipe_editor_access_context() from public;
revoke all on function public.recipe_editor_access_context() from anon;
grant execute on function public.recipe_editor_access_context() to authenticated;
