# r40.4 · Position-aware Shift v5

## Product rules

Working positions:
- Бармен
- Официант
- Менеджер
- Хостес

The position belongs to the profile and does not change authorization role.

Operational time:
- open from 11:00;
- may close until 02:59 next day;
- blocked from 03:00 through 10:59;
- new day begins at 11:00.

Authority timezone:
`Asia/Novosibirsk`.

## Migration safety

Stable r40.3 Shift RPCs and tables were not altered.

r40.4 receives an additive layer:
- `profiles.position_code`
- `position_shift_check_definitions`
- `position_shift_states`
- `position_shift_checks`
- `get_position_shift_workflow()`
- `set_position_shift_check(...)`
- `confirm_position_shift(...)`

The read RPC is non-destructive:
opening `/shift` does not create a shift or checks.

The first actual saved checklist action creates the current positional state when needed.

## Existing data

Recognized legacy profile positions were mapped:
- Бар-менеджер → bartender
- Менеджер
- Хостес → manager
- Официант → waiter

Null positions remain null and must be chosen in Profile.

Existing Bar shift definitions were copied to `bartender`.

Demo definitions were added for:
- `waiter`: hall cleanliness, table setup, menu/stop-list, POS, supplies, reservations; plus closing/guest handover items.
- `manager`: checks of Bar readiness, Waiter/hall readiness, POS/cash, stop-list, reservations/briefing; plus closing verification, reports, handover and safety.
- `hostess`: reception/entrance readiness, reservations, seating plan, menus, guest information; plus next-day reservations, guest issues, lost & found, reception reset and handover.

These demo procedures are placeholders for operational review and can be edited later without changing the Shift architecture.

## QA

Safe:
- open Profile
- inspect position selector
- open Shift
- inspect position label, operational window, progress and checklist
- refresh / leave / return
- inspect locked/unconfigured states where naturally applicable

Mutating:
- saving a new profile position
- checking/unchecking a shift item
- confirming opening
- confirming closing

Mutating checks affect shared operational data and should be deliberate.


## Smooth checklist interaction

Checkbox changes no longer reload the complete Shift workflow.

Behavior:
- a tapped row enters its own pending state;
- other rows remain fully visible and interactive;
- multiple different rows can save concurrently;
- the visual checkmark appears only after the server RPC succeeds;
- success patches only the returned row in React state;
- failure leaves the previous checked state unchanged;
- confirm open/close is temporarily disabled while any item write is pending;
- full refresh remains for explicit refresh, foreground return, and open/close phase transitions.

This removes the old whole-list dim/flicker effect while preserving server authority.
