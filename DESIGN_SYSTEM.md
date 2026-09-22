# BeerFactory Staff Portal · DESIGN SYSTEM v1.1

Status: active contract for `r40.4-react`.

Visual reference:
`docs/design/BFStaff_design-system-preview.png`

The mockup is a visual target, not decorative concept art. If product logic or UX changes materially,
the reference is updated together with the implementation direction.

## Core rule

**An action the user is expected to notice must look actionable at rest.**

No important action may depend on hover to reveal that it is clickable.

### Primary
Copper fill. Main forward action.

Examples:
- Start / Answer / Finish attestation
- Save position
- Confirm opening
- Confirm closing

### Secondary
Visible border + surface. Normal discoverable action.

Examples:
- Attestation from Knowledge
- Repeat topic
- Open handover
- Retry
- Profile support actions

### Ghost
Restricted to already-obvious support navigation:
- Back
- Exit flow
- Close

Never use ghost for discoverable work actions.

## Staff role vs working position

These concepts are visually and technically separate.

Access role:
- staff
- senior
- manager
- admin

Working position:
- Бармен (`bartender`)
- Официант (`waiter`)
- Менеджер (`manager`)
- Хостес (`hostess`)

Selecting position must never grant access rights.

Position is edited only in the employee profile context, not as an inline accidental control in
operational screens.

## Shift contract

Shift is role-aware by working position.

Operational window, venue time:
- opens at 11:00;
- remains the same operational day through 02:59 next calendar day;
- at 03:00 it becomes unavailable;
- 03:00–10:59 is locked;
- new operational day becomes available at 11:00.

The UI must never use device clock as authority.

The current position's phase is visually dominant.

Checklist rows:
- full-row tap target;
- visible checkbox affordance;
- pending state belongs only to the row being saved;
- other checklist rows remain interactive while independent saves are pending;
- no full workflow reload after an ordinary checkbox change;
- server-acknowledged checked state only;
- confirmation waits until all pending item saves finish;
- critical marker when applicable.

Viewing Shift must be non-destructive.
Opening the page alone must not create an operational shift record.

## Profile position selector

Four visible selectable controls in a 2×2 mobile grid:
- Бармен
- Официант
- Менеджер
- Хостес

Selection is staged locally and applied only by the visible primary action `Сохранить должность`.

The Profile screen must explicitly state that position affects the Shift checklist but not access rights.

## Data-driven module states

Every module defines:
- loading
- ready
- empty
- disabled
- pending
- error
- unavailable/offline
- success
- locked/conflict where applicable

Operational modules may not claim local-only success.
