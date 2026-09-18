# BeerFactory Staff Portal · TASKS

Status legend:
- [x] Done
- [ ] Active / planned
- [~] In progress
- [!] Blocker / manual action
- [F] Frozen

---

## CURRENT BASELINE

- [x] GitHub main is the canonical frontend baseline
- [x] recipes.js r17 is in main
- [x] learning.js / learning.css r19 are in main
- [x] app.js r11 is in main
- [x] app.css r10 is in main
- [x] Cloudflare Worker responds successfully and reads NocoDB
- [x] Supabase project is ACTIVE_HEALTHY
- [x] Auth / recovery / profile / admin Edge Functions are active
- [x] 4 staff profiles currently exist in Supabase

---

# SPRINT 0 · PROJECT GOVERNANCE

- [x] Establish PROJECT_SPEC.md v2
- [x] Establish TASKS.md
- [ ] Keep PROJECT_SPEC.md synchronized after architectural changes
- [ ] Keep TASKS.md synchronized after each completed sprint
- [ ] Stop using old ZIP archives as source of truth
- [ ] Use GitHub main as implementation baseline
- [ ] Prefer branches / PRs for large Codex changes when write access is available

Definition of Done:
- A developer or Codex can understand the current product and priorities without reading chat history.

---

# SPRINT 1 · RECIPES

Status: IN PROGRESS

## Already done
- [x] NocoDB as recipe/menu source
- [x] Cloudflare Worker between frontend and NocoDB
- [x] NocoDB token removed from current frontend architecture
- [x] Search UI
- [x] Category filters
- [x] Search includes name
- [x] Search includes category / visible alias
- [x] Search includes ingredients
- [x] Search includes tags
- [x] Photo display
- [x] Lightbox
- [x] Recipe calculator for preparations
- [x] Single "Порции" input
- [x] Live recalculation
- [x] Decimal input with comma or dot
- [x] Compact front cards
- [x] Individual tag pills
- [x] Alternating tag colors
- [x] Display alias "Лимонад" -> "Б/А напитки"
- [x] Tap-to-flip technical card

## Active
- [ ] Add robust offline cache / last-known-good recipe data
- [ ] Verify cache survives Worker/NocoDB temporary outage
- [ ] Test on 360 px width
- [ ] Test on 390 px width
- [ ] Test on 430 px width
- [ ] Test long recipe names
- [ ] Test 0 tags / 1 tag / 6+ tags
- [ ] Test long preparation text
- [ ] Test photos with portrait / landscape / square aspect ratios
- [ ] Test calculator lines with ml / l / g / gr / kg / pcs / portions
- [ ] Review malformed ingredient lines that cannot be scaled
- [ ] Test with 3 real staff members
- [ ] Measure recipe find time
- [ ] Decide: keep flip-card or replace with simpler accordion/drawer
- [ ] FREEZE recipe UI after validation

Definition of Done:
- 3 staff members can find a requested recipe without help in <= 20 seconds.
- Temporary network failure does not make previously loaded recipes unavailable.
- No obvious mobile layout failures.
- UI interaction pattern is validated, not merely visually preferred.

---

# SPRINT 2 · RECIPE GOVERNANCE

Status: NEXT

## NocoDB schema
- [ ] Add recipe Status
- [ ] Add Version
- [ ] Add Updated at
- [ ] Add Updated by
- [ ] Add Change note

Statuses:
- Draft
- Current
- Archive

## Worker / frontend
- [ ] Worker exposes governance fields safely
- [ ] Portal shows only Current recipes to staff
- [ ] Portal may show update date
- [ ] Portal may show short change note
- [ ] Define archive behavior

Definition of Done:
- There is no ambiguity about which recipe is current.
- A manager can explain who changed a recipe and why.

---

# SPRINT 3 · KNOWLEDGE

Status: IN PROGRESS

## Existing
- [x] learning.js / learning.css r19
- [x] Training / knowledge assets exist
- [x] Service materials exist
- [x] Article image lightbox exists in earlier module work

## Active / next
- [ ] Audit r19 structure against actual staff workflow
- [ ] Normalize categories:
  - Service
  - Bar
  - Kitchen
  - Alcohol
  - Beer
  - SOP
- [ ] Remove duplicate / obsolete content
- [ ] Ensure mobile article readability
- [ ] Search by article title
- [ ] Search by article body
- [ ] Search by category
- [ ] Add direct links from operational tasks to relevant SOP
- [ ] Add last-updated metadata where useful
- [ ] Define knowledge content owner / editor process

Definition of Done:
- Staff can locate a needed instruction in <= 30 seconds.
- Operational instructions are not duplicated in conflicting versions.

---

# SPRINT 4 · ATTESTATION

Status: PLANNED

## Content
- [x] Existing large kitchen/bar question bank
- [x] Service materials available for question generation
- [ ] Finalize question banks by category
- [ ] Remove ambiguous / low-value questions
- [ ] No unnecessary gram/ml memorization

## Backend
- [ ] Extend / confirm quiz_attempts schema
- [ ] Decide whether per-answer history is required
- [ ] Store user
- [ ] Store category
- [ ] Store started_at
- [ ] Store finished_at
- [ ] Store total_questions
- [ ] Store correct_answers
- [ ] Store score
- [ ] Store passed
- [ ] Store category_results / weak topics

## UX
- [ ] Random subset from larger bank
- [ ] Shuffle answers
- [ ] Define pass threshold
- [ ] Define retry policy
- [ ] Define manager visibility
- [ ] Show useful failure feedback

Definition of Done:
- Results persist in Supabase and are attributable to a staff member.
- Repeating the test does not simply replay the same questions.
- A manager can see meaningful weak areas.

---

# SPRINT 5 · SHIFT HANDOVER

Status: PLANNED

Do NOT build a Telegram clone.

## Data model
- [ ] Category
- [ ] Priority
- [ ] Author
- [ ] Created at
- [ ] Body
- [ ] Status
- [ ] Acknowledged by
- [ ] Acknowledged at
- [ ] Resolved by
- [ ] Resolved at

Suggested categories:
- Bar
- Kitchen
- Hall
- Equipment
- Purchasing
- Other

Suggested states:
- New
- Acknowledged
- Resolved

## UX
- [ ] Show unresolved important handovers first
- [ ] One-tap acknowledge
- [ ] One-tap resolve
- [ ] Filter by category
- [ ] Link to relevant recipe/SOP if applicable

Definition of Done:
- Next shift can immediately see what matters without reading a chat history.

---

# SPRINT 6 · OPENING / CLOSING CHECKLISTS

Status: PLANNED

Rules:
- Max roughly 10-15 meaningful items per checklist.
- No ceremonial checkbox spam.

- [ ] Define Bar opening checklist
- [ ] Define Bar closing checklist
- [ ] Decide whether Hall needs separate checklist
- [ ] Decide whether Kitchen needs separate checklist
- [ ] Support checkbox item
- [ ] Support numeric / temperature item where needed
- [ ] Support photo proof only for critical cases
- [ ] Record completed_by / completed_at
- [ ] Prevent fake "all green" UX from hiding incomplete critical items

Definition of Done:
- Checklist catches real operational failures rather than merely documenting taps.

---

# SPRINT 7 · HOME DASHBOARD

Status: PLANNED

Home should answer: "What do I need to know or do now?"

- [ ] Current shift status
- [ ] Important unresolved handover
- [ ] New recipe / SOP update
- [ ] Pending attestation if relevant
- [ ] Global search entry
- [ ] Remove decorative widgets that do not drive work

---

# SPRINT 8 · HARDENING

Status: PLANNED

## Supabase security / performance
- [ ] Document intentional service-role-only recovery_attempts behavior
- [ ] Review leaked-password warning relevance to custom staff auth
- [ ] Add covering indexes for useful foreign keys when operational tables start being used
- [ ] Optimize RLS auth function calls with SELECT wrappers where appropriate
- [ ] Re-run security advisor
- [ ] Re-run performance advisor

## Audit
- [ ] Create audit_log schema
- [ ] Record admin role changes
- [ ] Record activation/deactivation
- [ ] Record important resets
- [ ] Record future critical operational changes

## Frontend / PWA
- [ ] Offline strategy
- [ ] Error states
- [ ] Slow network states
- [ ] Cache invalidation/versioning
- [ ] iOS PWA behavior
- [ ] Accessibility sanity pass

## Documentation
- [ ] Deployment notes
- [ ] Recovery procedure
- [ ] Backup plan
- [ ] Service ownership map

---

# SPRINT 9 · PILOT

Status: PLANNED

Duration:
7-14 days

Participants:
- [ ] 1 experienced employee
- [ ] 1 average employee
- [ ] 1 newcomer if possible

Measure:
- [ ] recipe lookup time
- [ ] knowledge lookup time
- [ ] independent repeat usage
- [ ] attestation comprehension
- [ ] handover adoption
- [ ] failure / confusion points

Decision after pilot:
- [ ] Keep
- [ ] Simplify
- [ ] Remove
- [ ] Improve

---

# FROZEN BACKLOG

Do not implement without explicit promotion from Frozen.

- [F] Internal chat
- [F] Games
- [F] Mini-apps for entertainment
- [F] Gamification
- [F] Employee rankings
- [F] Achievements
- [F] Payroll
- [F] Staff scheduling
- [F] Inventory
- [F] Purchasing system
- [F] Full food costing
- [F] Embedded AI assistant
- [F] Complex analytics dashboards

---

# MANUAL BLOCKERS / ACCESS

- [!] GitHub ChatGPT integration currently reads repository but write attempts return 403.
- [ ] Until fixed, user manually uploads/replaces governance files or code packages when required.
- [ ] Cloudflare has no working direct ChatGPT connector in this workspace.
- [ ] Worker changes may require manual Edit Code / Deploy unless later moved to Wrangler/GitHub deployment.

---

# TEAM LEAD RULE

Before starting any new feature:
1. Check this file.
2. Finish or explicitly defer the current Active item.
3. Update status.
4. Only then promote the next item.

No scope creep by enthusiasm.
