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

## 9. Recipe governance · next
NocoDB fields:
- Status: Draft / Current / Archive
- Version
- Updated at
- Updated by
- Change note

Staff should only see Current recipes.

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
- read state;
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
- persist results in Supabase;
- later expose weak topics to managers.

## 12. Shift handover
Structured operational handover, not a chat clone.

Fields:
- category;
- priority;
- author;
- created_at;
- body;
- status;
- acknowledged_by/at;
- resolved_by/at.

## 13. Checklists · later
Short, meaningful opening/closing workflows.
Rough target 10-15 items, with evidence only when operationally justified.

## 14. UX validation
Real-device validation is mandatory for major mobile/browser changes.

Current verified baseline:
- iPhone: portal, recipes, technical card and calculator work online/offline.
- Android: portal, recipes, technical card and calculator work online/offline.
- Knowledge works online/offline on tested devices.

Formal timed staff lookup testing is deferred by product-owner decision. Do not block Recipes on that test unless it is explicitly reinstated.

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

## 16. Design review rule
Before adopting or replacing a major interaction:
1. check whether the pattern is contemporary and appropriate for current mobile products;
2. check whether it scales to the likely future native app;
3. check accessibility and browser/device behavior;
4. distinguish purposeful animation from novelty;
5. prefer a better long-term system even if implementation is more work;
6. still reject complexity that adds no user value.

## 17. MVP Done
Ready for pilot when:
- Recipes are current, offline-capable and stable on iPhone/Android.
- Knowledge is usable/searchable/offline-capable.
- Attestation persists in Supabase.
- Shift handover persists in Supabase with acknowledgement/resolution.
- Auth/profile/admin remain stable.
- No frontend secrets.
- Hardening pass complete.
- PROJECT_SPEC and TASKS match production.
