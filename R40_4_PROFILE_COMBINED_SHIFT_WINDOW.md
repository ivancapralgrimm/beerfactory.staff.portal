# BeerFactory r40.4 · Profile combined details + shift-window position rule

## UI

Birthday and Working Position are merged into one Profile surface.

Order:
1. Birthday
2. divider
3. Working position

Working position uses a native `<select>` so iOS/Android can present the same native choice interaction used in the Admin reference.

## Position-change rule

The previous proposed rolling 24-hour cooldown is NOT used.

Employee self-service position changes follow the existing BFStaff operational-day model:

- venue timezone: `Asia/Novosibirsk`;
- working window: 11:00 through 02:59;
- 03:00 through 10:59: locked;
- each window maps to one operational date;
- employee may self-change position once per operational date/window;
- after a successful change, the next self-service change becomes available when the next working window opens.

Examples:

- change at 18:00 Monday -> next change Tuesday 11:00;
- change at 01:30 Tuesday -> it belongs to Monday's operational date, next change Tuesday 11:00;
- attempt at 06:00 -> blocked until 11:00.

## Server authority

The frontend does not calculate the operational day.

Both availability and mutation are derived from the existing database function:
`private.shift_window_context()`.

The new RPC:
`public.get_profile_position_self_service_context(...)`
returns server-authoritative availability for Profile UI.

The mutation RPC:
`public.set_profile_position_self_service(...)`
row-locks the profile and rejects:
- changes outside the working window;
- a second self-service change during the same operational date.

Both RPCs are service-role only and remain behind the authenticated `staff-profile` Edge Function.

## Admin

Admin position management remains independent from the employee self-service limit.

## Files

REPLACE:
- `src/pages/ProfilePage.tsx`
- `src/types/auth.ts`
- `supabase/functions/staff-profile/index.ts`

ADD:
- `supabase/migrations/20260924182000_add_profile_position_shift_window_limit.sql`
- `R40_4_PROFILE_COMBINED_SHIFT_WINDOW.md`
