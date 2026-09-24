# BeerFactory Staff Portal · DESIGN SYSTEM v1.1

Status: active contract for `r40.4-react`. The attached four-screen mockup takes precedence for visual choices.

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

## Mockup visual lock (September 2026)

The four-phone BeerFactory mockup is the visual authority for the React migration.
Use a near-black brown canvas (`#17120e`), restrained copper (`#ba6638`), cream text,
subtle brown borders, compact controls, and a small bottom navigation dock. There is
no persistent global top header. The profile entry is available on Dashboard.

At approximately 390 CSS pixels, Dashboard uses a brewery photograph behind a
compact greeting, then a shift status entry, a 2×2 grid of quick actions, one
attestation row, a copper recipe CTA, and a profile action. Live birthday and active
handover sections remain conditional and use real server data. At other screens,
keep page titles below the top safe area and avoid a global brand header.

Buttons retain the accessibility contract above. Dock links provide 44px or larger
interactive regions, visible keyboard focus and bottom safe-area padding.

## Internal recipe and article pages

The approved extension to the four-screen reference uses the compact, continuous
layout of option A. On mobile, the title is approximately 27–28px, content begins
directly beneath the back action, and section labels are small copper uppercase text.
Paragraphs are approximately 14px with a comfortable 1.65 line-height.

Recipe ingredients are a single rounded, bordered surface with compact divided rows.
Only show this surface when the source recipe supplies ingredient content; an absent
ingredient list is not represented by an empty panel. When the source method begins
with a separate `Состав:` line, its comma-separated items may populate the same
surface without modifying source data; any remaining method text stays in its section.
Method and serving remain readable sections using their real source values. Existing
photographs and the calculator appear only where the recipe supplies them. Secondary recipe metadata is
available through a compact disclosure.

Articles retain their source headings, callouts, lists, images, read status and actions.
Callouts use the same rounded surface as other content. The article title and vertical
spacing follow the compact recipe rhythm. Images appear only when present in article
content; the image dialog and read persistence remain functional. The compact
section navigator appears when at least two headings match complete topics from the
article title. Standalone bold facts, subdivisions and long explanations never become
navigation controls or chapter cards. Its buttons lead to those headings and respect
reduced-motion preferences. Targets keep at least 104px of top clearance, including
the mobile safe area, so the selected chapter title stays visible after navigation.
The chapter titles are compact rounded surface labels within the article body.

## Attestation completion motion

A server-independent result celebration plays once when the actual answer count meets
the category's passing threshold (`result.passed`, normally 80% or higher). The trophy
and result remain readable while two copper, gold, cream and green confetti jets
fire outward and the pieces fall behind the result to the bottom of its information
area over approximately 3–4 seconds. The floor is implied, not drawn. Failed
attempts have no confetti. Reduced-motion preference
suppresses the particles entirely; the score and actions are still visible.
