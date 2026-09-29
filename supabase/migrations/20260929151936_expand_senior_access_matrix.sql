-- BFStaff r40.4 hotfix
-- Expand Senior access consistently across all staff positions.
--
-- Senior:
-- - bartender / bartender_bb / waiter / waiter_bb / manager:
--   Recipes + own checklist
-- - hostess:
--   own checklist only
--
-- Admin / Owner:
-- - all recipe editing
-- - all checklist positions
--
-- Staff:
-- - no editors

create or replace function private.can_manage_recipes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and (
        p.is_owner is true
        or p.role = 'admin'::public.staff_role
        or (
          p.role = 'senior'::public.staff_role
          and p.position_code in (
            'bartender'::public.staff_position,
            'bartender_bb'::public.staff_position,
            'waiter'::public.staff_position,
            'waiter_bb'::public.staff_position,
            'manager'::public.staff_position
          )
        )
      )
  )
$$;

create or replace function private.editable_checklist_positions()
returns public.staff_position[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null or p.is_active is not true
      then '{}'::public.staff_position[]
    when p.is_owner is true
      or p.role = 'admin'::public.staff_role
      then array[
        'bartender'::public.staff_position,
        'waiter'::public.staff_position,
        'bartender_bb'::public.staff_position,
        'waiter_bb'::public.staff_position,
        'manager'::public.staff_position,
        'hostess'::public.staff_position
      ]
    when p.role = 'senior'::public.staff_role
      and p.position_code is not null
      then array[p.position_code]::public.staff_position[]
    else '{}'::public.staff_position[]
  end
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;
