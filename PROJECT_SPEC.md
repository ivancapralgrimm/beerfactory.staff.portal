# BeerFactory Staff Portal · PROJECT_SPEC v3

## 1. Product goal
BeerFactory Staff Portal is a mobile-first internal operating product for bar/brewery staff.

It must help staff:
1. find and use current recipes;
2. find operational knowledge;
3. confirm knowledge through attestation;
4. transfer important information between shifts;
5. later complete short opening/closing workflows.

The product is allowed to be technically sophisticated when that sophistication produces a better long-term interface. "Simpler to implement" is not a product principle.

## 2. Product and design principles
- Mobile first across iPhone and mainstream Android devices, including Samsung, Xiaomi and Poco.
- Design for Safari, Chrome, Samsung Internet and modern Chromium-based Android browsers.
- One-thumb usability during a shift.
- Search before deep navigation.
- One source of truth per data type.
- Operational clarity beats decoration, but visual quality is not optional.
- Prefer durable contemporary product patterns that can migrate cleanly to a future native iOS/Android app.
- Do not choose a UI pattern merely because it is easy to code.
- Avoid interaction gimmicks as primary navigation. Animation must explain state, hierarchy or causality.
- Progressive disclosure is preferred over hiding core information behind novelty interactions.
- New visual patterns must be reviewed for current product relevance, accessibility and long-term scalability.
- No duplicate Telegram-style internal chat.
- No sensitive HR/payroll/passport/bank data.
- No secrets or private API tokens in frontend code.

## 3. MVP scope
### P0 · Core
1. Recipes
2. Knowledge
3. Attestation
4. Shift handover
5. Auth / staff profile / admin support required by the core

### P1 · After core
6. Opening / closing checklists
7. Contextual home dashboard
8. Audit log
9. Basic manager analytics

### Frozen
- internal generic chat;
- games / mini-apps;
- gamification / rankings / achievements;
- payroll;
- scheduling;
- inventory / purchasing;
- full food-costing;
- embedded AI assistant.

## 4. Source of truth
### Recipes
NocoDB -> Cloudflare Worker -> frontend.

### Staff / auth / operational data
Supabase:
- profiles;
- roles;
- quiz attempts;
- training progress;
- shifts/checks;
- handover;
- notifications;
- future audit log.

### Code
GitHub `ivancapralgrimm/beerfactory.staff.portal`, branch `main`.

### Local storage / browser cache
Cache and temporary UI state only. Never canonical operational storage.

## 5. Production architecture
Static mobile-first PWA
-> Supabase for auth/operational backend
-> Cloudflare Worker for recipe API
-> NocoDB for recipe content

Recipe Worker:
`https://beerfactory-menu-api.ivan-capral-grimm.workers.dev`

## 6. Frontend modules
- `app.js`: shell/auth/profile/admin/core legacy routes
- `app.css`: base design system
- `recipes.js`: recipe behavior/data/cache
- `recipes.css`: recipe presentation
- `learning.js`: knowledge + current attestation UI
- `learning.css`: knowledge presentation
- `mobile-compat.css`: browser fallbacks only
- `sw.js`: offline shell/runtime cache
- `index.html`: wiring
- `assets/`: content/media

GitHub `main` is always the baseline after deployment. ZIP archives are transfer packages, not the source of truth.

## 7. Authentication
Staff credentials:
- first name;
- last name;
- password;
- secret recovery code.

Roles:
- staff
- senior
- manager
- admin

Owner remains separately protected. Public registration cannot choose role.

## 8. Recipes · canonical UX
Recipe navigation uses a modern list -> detail model.

### Browse
- search by name/category/visible alias/ingredient/tag;
- horizontal category rail while category count remains manageable;
- compact tappable recipe rows;
- no flip-card as primary interaction.

### Recipe detail
A recipe is a first-class product entity with its own deep-linkable URL state.

The detail workspace supports:
- title/category/subcategory/tags;
- hero photo and lightbox;
- ingredients;
- calculator where relevant;
- preparation;
- serving/output;
- future version/date/change-note metadata;
- share/copy link;
- browser/device back behavior.

This structure is intentionally compatible with a future native app information architecture.

### Calculator
- one portions value;
- decimal input;
- live recalculation;
- +/- convenience controls;
- preserve original ingredient text wherever possible.

### Offline
Previously synchronized recipes must remain available during temporary network loss.
Application shell and Knowledge assets are cached by Service Worker.

## 9. Recipe governance
NocoDB fields:
- `Статус`: Черновик / Актуальный / Архив
- `Версия`
- `Обновлено`
- `Кем обновлено`
- `Что изменено`

Empty status is treated as `Актуальный` during migration.
`Черновик` is excluded from staff responses.
`Архив` remains readable for staff, but is excluded from normal browse/categories.
Archive is exposed as a dedicated pseudo-category `Архив` and is included in global search results after current items.
Archived recipe detail must show an explicit archive warning.
Recipe detail supports Version / Updated / Updated by / Change note.

## 10. Knowledge
Knowledge is short, searchable and operational.

Target categories:
- Service
- Bar
- Kitchen
- Alcohol
- Beer
- Wine
- SOP

Knowledge uses the same durable information architecture as Recipes: searchable browse list -> first-class article detail.

Articles support:
- normalized visible categories;
- reading time;
- read state persisted in Supabase `training_progress` with local offline fallback;
- image lightbox;
- direct share/copy link;
- offline availability after successful cache population.

Knowledge articles are first-class detail views and must remain available offline after successful cache population.

## 11. Attestation
Target:
- Bar
- Kitchen
- Service
- General knowledge

Rules:
- random subset;
- shuffled answers;
- avoid pointless gram/ml memorization;
- results persist in Supabase `quiz_attempts`;
- attempt stores category, timing, score/pass state and topic-level weak areas;
- localStorage is fallback cache only;
- later expose weak topics to managers.

## 12. Shift handover
Structured operational handover, not a chat clone.

Source of truth: Supabase `notes`.

Fields:
- category;
- priority;
- author;
- created_at;
- body;
- status;
- acknowledged_by/at;
- resolved_by/at.

Staff may create handovers but cannot directly forge acknowledgement/resolution fields.
Acknowledgement and resolution use constrained Supabase RPC functions.

## 13. Opening / closing
Shift checklist source of truth is Supabase `shifts` + `shift_checks`.

Rules:
- one shared shift per operational date;
- opening and closing are separate phases;
- staff checks individual items through constrained RPC;
- shift cannot open/close until every active item for that phase is complete;
- completed_by / completed_at are server-controlled;
- open/close events are audited;
- offline UI must never pretend an operational checklist was synchronized;
- photo/numeric evidence is added only where operationally justified.

## 14. Home dashboard
Home answers: “What do I need to know or do now?”

Prepared:
- today’s shift state;
- unresolved/critical handover;
- personal Knowledge completion count;
- latest attestation result;
- combined Recipes + Knowledge search;
- direct work shortcuts.

Home does not display stale operational state as current when Supabase is unavailable.

## 15. UX validation
Real-device validation is mandatory for major mobile/browser changes.

Current verified baseline:
- iPhone: portal, recipes, technical card and calculator work online/offline.
- Android: portal, recipes, technical card and calculator work online/offline.
- Knowledge works online/offline on tested devices.

Formal timed staff lookup testing is deferred by product-owner decision. Do not block Recipes on that test unless it is explicitly reinstated.

## 16. Design tokens
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

## 17. Design review rule
Before adopting or replacing a major interaction:
1. check whether the pattern is contemporary and appropriate for current mobile products;
2. check whether it scales to the likely future native app;
3. check accessibility and browser/device behavior;
4. distinguish purposeful animation from novelty;
5. prefer a better long-term system even if implementation is more work;
6. still reject complexity that adds no user value.

## 18. MVP Done
Ready for pilot when:
- Recipes are current, offline-capable and stable on iPhone/Android.
- Knowledge is usable/searchable/offline-capable.
- Attestation persists in Supabase.
- Shift handover persists in Supabase with acknowledgement/resolution.
- Auth/profile/admin remain stable.
- No frontend secrets.
- Hardening pass complete.
- PROJECT_SPEC and TASKS match production.


## 18. Recipe write security
Recipe governance writes are admin-only.

- frontend admin visibility is presentation only;
- Worker verifies Supabase access token;
- Worker reads the authoritative profile role;
- only active `admin` may mutate recipe governance;
- read and write NocoDB credentials are separate;
- NocoDB write token is stored only as a Cloudflare secret;
- current viewer token should remain read-only.


### Audit log
Supabase `public.audit_log` is the canonical immutable audit trail for sensitive admin/recipe governance actions.

Current audited action families:
- recipe governance updates;
- staff role changes;
- activation/deactivation;
- password/recovery-code administrative resets.

The admin portal provides a read-only history view. Credentials/hashes are never stored in audit payloads.


### Admin console
The current admin console is organized into:
- Employees;
- Attestations;
- Audit.

Attestation visibility shows recent attempts, pass state, score and weak topics without exposing question-bank answer keys.


### Staff deletion
Admin may permanently delete a non-owner user other than self.

Deletion policy:
- disable target before purge;
- delete Auth user and profile;
- cascade personal quiz/training/notification/message data;
- delete handovers authored by the target;
- preserve shared shift/operational records while clearing personal foreign-key references;
- anonymize historical audit events where the deleted user was the actor;
- retain one non-identifying `profile_delete` audit event;
- deletion is irreversible and requires explicit typed confirmation in UI.


### Runtime hardening
- network loss is visible globally;
- Recipes and Knowledge may use verified cache/offline data;
- shift/handover operational writes never report local-only success;
- Service Worker uses versioned shell caches and network timeouts;
- versioned content may fall back to its pre-cached queryless asset only when network fetch fails;
- accessibility layer provides focus visibility, skip navigation, dialog semantics and reduced-motion behavior.

### Recipe governance capability negotiation
Recipe governance editing is shown only when the Cloudflare Worker explicitly advertises the governance capability.
Write controls enable only when the Worker reports a server-side write credential is configured.
This prevents a frontend deployment from exposing dead admin controls before the NocoDB/Worker migration is complete.
