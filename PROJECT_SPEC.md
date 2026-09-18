# BeerFactory Staff Portal · PROJECT_SPEC v2

## 1. Product goal
BeerFactory Staff Portal is a mobile-first internal operating tool for bar/brewery staff.

Its job is not to become a generic ERP. It must help staff:
1. find a recipe or instruction fast;
2. learn the required standard;
3. confirm knowledge through attestation;
4. transfer operational information between shifts;
5. later complete short opening/closing checklists.

Success is measured by staff using it without a manager forcing them to.

## 2. Product principles
- Mobile first: primary targets are iPhone widths 360 / 390 / 430 px.
- One-thumb operation during a busy shift.
- Search before deep navigation.
- One source of truth for each data type.
- Operational speed beats decorative UI.
- New features are frozen until the current core module reaches Done.
- No duplicate Telegram-style internal chat.
- No sensitive HR/payroll/passport/bank data in the portal.
- No secrets or private API tokens in frontend code.

## 3. MVP scope

### P0 · Core
1. Recipes
2. Knowledge
3. Attestation
4. Shift handover
5. Auth / staff profile / admin support required by the four modules

### P1 · After core adoption
6. Opening / closing checklists
7. Home dashboard driven by current work context
8. Audit log
9. Basic manager analytics

### Frozen
Do not implement until the core has proven adoption:
- internal chat;
- games / mini-apps;
- gamification / rankings / achievements;
- payroll;
- scheduling;
- inventory / purchasing;
- full food-costing;
- embedded AI assistant.

## 4. Source of truth

### Recipes / menu / preparations
NocoDB is the source of truth.

Portal access path:
NocoDB -> Cloudflare Worker -> frontend.

The browser must never connect to NocoDB using a token directly.

### Staff / auth / operational data
Supabase is the source of truth for:
- profiles;
- roles;
- authentication support;
- quiz attempts;
- training progress;
- shifts;
- shift checks;
- handover notes;
- notifications;
- future audit log.

### Application code
GitHub repository:
ivancapralgrimm/beerfactory.staff.portal

Default branch: main.

### Local storage
localStorage may be used only as cache / temporary UI state / offline fallback.
It must not be treated as the canonical store for operational records.

## 5. Current production architecture

Static mobile-first frontend / PWA
-> Supabase for auth and operational backend
-> Cloudflare Worker for recipe API
-> NocoDB for recipe content

Current recipe Worker:
https://beerfactory-menu-api.ivan-capral-grimm.workers.dev

Supported recipe endpoints:
- /
- /menu
- /recipes

## 6. Current repository baseline

Current production frontend split:
- app.js: application shell, auth/profile/admin and legacy/core routes
- app.css: base design system
- recipes.js: recipe module
- learning.js: knowledge module
- learning.css: knowledge-specific styles
- index.html: script/style wiring
- assets/: training/question/service assets
- manifest.json: PWA metadata

Current deployed module generations at the time of this spec:
- app.js r11
- app.css r10
- recipes.js r17
- learning.js / learning.css r19

Do not assume old ZIP archives are current. GitHub main is the baseline.

## 7. Authentication model

Staff-facing credentials:
- first name;
- last name;
- Password;
- Secret code for recovery.

Do not expose internal Supabase email credentials to staff.

Roles:
- staff
- senior
- manager
- admin

The owner account is protected separately from ordinary admins.

Public registration must not allow role selection.
New registration defaults to staff.

Admin operations must never expose plaintext passwords or secret codes.

## 8. Supabase baseline

Main public entities currently available:
- profiles
- shifts
- shift_checks
- notes
- messages
- notifications
- quiz_attempts
- training_progress
- recovery_attempts
- recovery_rate_limits

Active Edge Functions:
- staff-login
- staff-register
- staff-profile
- staff-recover
- staff-set-recovery
- staff-admin-users

RLS is enabled on the public application tables.

Known hardening work is tracked in TASKS.md and should not interrupt Recipe/Knowledge MVP work unless it becomes a security blocker.

## 9. Recipes module

### Required user experience
Staff must be able to find a recipe in under 20 seconds.

Search must cover:
- recipe name;
- visible category label;
- source category;
- tags;
- ingredients.

### Current recipe UI direction
- compact front card;
- category;
- recipe name;
- flavor/character tags;
- tap to reveal technical card;
- full recipe side contains photo, composition, calculator where relevant, method and serving;
- photo supports lightbox;
- calculator is only for preparations where scaling is useful.

### Calculator
Current mode:
- one input: Portions;
- decimal values such as 0,5 / 3 / 4,5;
- live recalculation;
- empty value behaves as zero;
- original unit text is preserved where possible.

### Display aliases
NocoDB content values do not need to be rewritten to change portal labels.
Example:
- source category "Лимонад" may be displayed as "Б/А напитки".

### Recipe governance · next stage
NocoDB must later support:
- Status: Draft / Current / Archive;
- Version;
- Updated at;
- Updated by;
- Change note.

Staff portal should show only Current recipes.

## 10. Knowledge module

Knowledge must be short, searchable and operational.

Target categories:
- Service;
- Bar;
- Kitchen;
- Alcohol;
- Beer;
- SOP / working instructions.

Where possible, operational screens should deep-link directly to the relevant instruction instead of requiring staff to browse Knowledge manually.

## 11. Attestation

Attestation is not just a decorative quiz.

Target categories:
- Bar;
- Kitchen;
- Service;
- General knowledge.

Rules:
- random subset from a larger bank;
- shuffled answers;
- no obsession with exact grams/ml unless operationally critical;
- results stored in Supabase;
- attempt history;
- category result;
- pass/fail state;
- later manager analysis of weak topics.

## 12. Shift handover

Build structured handover instead of an internal chat.

A handover record should support:
- category;
- priority;
- author;
- timestamp;
- message;
- status;
- acknowledged by;
- resolved by / resolved time.

Suggested statuses:
- New;
- Acknowledged;
- Resolved.

## 13. Checklists · later

Opening/closing checklists must remain short.
Target: roughly 10-15 meaningful items, not ceremonial checkbox spam.

Supported item types may later include:
- checkbox;
- photo proof;
- numeric/temperature value;
- critical item requiring explicit confirmation.

## 14. UX validation

Before declaring a major module Done, test it with at least 3 staff members:
- experienced employee;
- average employee;
- newcomer if available.

Core recipe benchmark:
- requested recipe found without help in <= 20 seconds.

If the flip-card interaction slows staff down or causes confusion, replace it with a simpler interaction. The animation is not a product requirement.

## 15. Design tokens

Background #14100D
Surface #241B15
Surface2 #2C2119
Border #49372A
Cream #F5EAD7
Muted #B9A58D
Copper #BD6331
Copper highlight #DF8B4E
Gold #C7A04B
Green #6EAA72
Red #D96A5E

## 16. Design rules
1. Mobile first.
2. High contrast and readable during a shift.
3. Search before long browse trees.
4. Horizontal category rails are acceptable while categories remain manageable.
5. Avoid modal overload.
6. Copper is the primary brand/action accent.
7. Gold is secondary.
8. Green/red are semantic.
9. Avoid textures that reduce readability.
10. Desktop is derived from mobile, not a separate product.
11. Do not add visual complexity unless it improves speed or comprehension.

## 17. Definition of MVP Done
The MVP is considered ready for pilot when:
- Recipes are functional, cached for temporary network loss and tested with staff.
- Knowledge structure is usable and searchable.
- Attestation results persist in Supabase.
- Shift handover persists in Supabase and supports acknowledgement/resolution.
- Auth/profile/admin flows remain stable.
- No secrets exist in frontend.
- Basic security/hardening review is completed.
- PROJECT_SPEC.md and TASKS.md match production reality.

After this point run a 7-14 day staff pilot before expanding scope.
