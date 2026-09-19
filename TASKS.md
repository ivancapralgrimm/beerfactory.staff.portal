# BeerFactory Staff Portal · TASKS

Status legend:
- [x] Done
- [ ] Active / planned
- [~] In progress
- [!] Blocker / manual action
- [F] Frozen

---

## CURRENT PRODUCTION BASELINE + NEXT PACKAGE

- [x] GitHub main is canonical after each deployment
- [x] app.js r11
- [x] app.css r10
- [x] learning.js / learning.css r23 after deployment
- [x] mobile compatibility layer exists
- [x] Service Worker offline shell exists
- [x] Cloudflare Worker reads NocoDB
- [x] Supabase project healthy
- [x] Auth / recovery / profile / admin Edge Functions active
- [x] Production auth/admin backend active; current profile count may change during pilot

---

# SPRINT 0 · PROJECT GOVERNANCE
- [x] PROJECT_SPEC established
- [x] TASKS established
- [x] GitHub main is implementation baseline
- [x] Old ZIPs are transfer/history only
- [~] Keep PROJECT_SPEC synchronized after architectural changes
- [~] Keep TASKS synchronized after meaningful milestones
- [ ] Prefer branches/PRs for large changes when GitHub write integration works

---

# SPRINT 1 · RECIPES
Status: ACTIVE, NEAR FREEZE

## Data / integration
- [x] NocoDB source
- [x] Cloudflare Worker layer
- [x] NocoDB token absent from frontend
- [x] Search by name
- [x] Search by category / visible alias
- [x] Search by ingredients
- [x] Search by tags
- [x] Category filters
- [x] Last-known-good recipe cache
- [x] Temporary outage fallback
- [x] Offline application shell
- [x] iPhone online/offline verification
- [x] Android online/offline verification

## Recipe UX
- [x] Photo
- [x] Lightbox
- [x] Calculator
- [x] Decimal portions
- [x] Mobile hardening
- [x] Flip-card retired
- [x] List -> detail architecture selected
- [x] Deep-linkable recipe state
- [x] Back restores browse context in-session
- [x] Recipe share/copy-link action
- [x] Detail structure prepared for Version / Updated / Change note
- [~] Final visual QA after r22 deploy

## Deferred by product-owner decision
- [ ] Timed 3-employee lookup test
- [ ] Formal <=20 sec measurement

These do NOT block the current recipe architecture unless explicitly reinstated.

## Remaining before freeze
- [ ] Verify r22 live on iPhone
- [ ] Verify r22 live on Android
- [ ] Verify deep link reload
- [ ] Verify browser/device Back
- [ ] Verify share/copy action
- [ ] Verify calculator after list -> detail migration
- [ ] Freeze recipe presentation after these checks

Definition of Done:
- Current recipe can be found and opened reliably.
- Temporary network failure preserves synchronized recipes.
- Detail view works across supported mobile browsers.
- Recipe entity is deep-linkable and structurally ready for governance metadata.

---

# SPRINT 2 · RECIPE GOVERNANCE
Status: IN PROGRESS

## NocoDB
- [ ] Status
- [ ] Version
- [ ] Updated at
- [ ] Updated by
- [ ] Change note

Statuses:
- Draft
- Current
- Archive

## Worker / frontend
- [x] Governance Worker implementation prepared
- [x] Frontend governance fields prepared
- [x] Defensive staff-side status filter prepared
- [x] Archived recipes excluded from normal browse but searchable
- [x] Archive pseudo-category + archive detail warning prepared
- [x] Detail supports Version / Updated / Updated by / Change note
- [x] Archive behavior revised: dedicated `Архив` view + global-search visibility
- [ ] Create governance fields in NocoDB
- [x] Bulk `Актуальный` marking no longer blocks migration; blank status temporarily means current
- [ ] Deploy Worker
- [ ] Deploy recipes.js r25
- [ ] Verify Draft/Archive are hidden

Definition of Done:
- No ambiguity about current recipe.
- Manager can identify who changed it and why.

---

# SPRINT 3 · KNOWLEDGE
Status: IN PROGRESS

## Existing
- [x] learning.js / learning.css r23 after deployment
- [x] Training assets
- [x] Service materials
- [x] Service images
- [x] Offline Knowledge content
- [x] training_progress unique user/article schema applied
- [x] Profile-backed article read state prepared in learning.js r31
- [x] Offline Service images
- [x] Search by title/body currently supported

## Completed in r23
- [x] Audit r19 browse/detail structure
- [x] Replace card grid with list -> article detail pattern
- [x] Normalize visible categories from current content
- [x] Separate beer article into visible Beer category through parser normalization
- [x] Search by title / body / category
- [x] Search result count
- [x] Preserve article lesson IDs used by question-bank review links
- [x] In-app article image lightbox
- [x] Article share/copy-link
- [x] Mobile article hierarchy pass

## Active / next
- [ ] Add missing content for Bar / Kitchen / SOP only when actual source material exists
- [ ] Remove duplicate / obsolete article content after editorial review
- [ ] Add direct operational links to relevant SOP
- [ ] Add last-updated metadata where useful
- [ ] Define content owner/editor process
- [ ] Deploy learning.js r31 in next common frontend update

Definition of Done:
- Staff can reach a needed instruction without conflicting duplicate versions.
- Articles remain usable offline after cache population.

---

# SPRINT 4 · ATTESTATION
Status: IN PROGRESS

## Content
- [x] Large question bank exists
- [x] Service materials exist
- [ ] Finalize categories and remove ambiguous questions
- [ ] No unnecessary gram/ml memorization

## Backend
- [x] quiz_attempts schema extended with category/category_id/started_at/finished_at
- [x] Supabase persistence prepared in learning.js r29
- [x] Store category / start / finish / total / correct / score / passed
- [x] Store topic breakdown and weak topics in category_results
- [x] Local history retained only as fallback cache
- [ ] Decide later whether per-answer history is actually useful
- [ ] Deploy learning.js r29 in next common frontend update

## UX
- [x] Random subset
- [x] Shuffle answers
- [x] Pass threshold 80%
- [x] Result/error review
- [x] Personal history prepared from Supabase
- [ ] Define retry policy
- [x] Admin visibility / weak-topic dashboard prepared
- [ ] Decide whether manager role should receive the same visibility

---

# SPRINT 5 · SHIFT HANDOVER
Status: IN PROGRESS

Do NOT build a Telegram clone.

- [x] Structured notes schema extended in Supabase
- [x] Category / Priority / Author / Created at / Body
- [x] Status: New / Acknowledged / Resolved
- [x] Acknowledged by/at
- [x] Resolved by/at
- [x] Important unresolved first
- [x] One-tap acknowledge via constrained RPC
- [x] One-tap resolve via constrained RPC
- [x] Category/status filters
- [x] Direct write privileges restricted to safe note columns
- [x] handover.js / handover.css prepared
- [ ] Link recipe/SOP where useful
- [ ] Deploy in next common frontend update
- [ ] Real-device pilot validation

---

# SPRINT 6 · OPENING / CLOSING
Status: IN PROGRESS

- [x] Bar opening shared checklist
- [x] Bar closing shared checklist
- [x] Checkbox persistence in Supabase
- [x] completed_by / completed_at
- [x] Backend blocks open/close until all active items complete
- [x] Direct staff writes to protected shift state removed
- [x] Open/close operations audited
- [x] shift-workflow.js / CSS prepared
- [ ] Decide later whether Hall/Kitchen need separate workflows
- [ ] Add numeric/temperature items only if operationally justified
- [ ] Add photo evidence only for critical cases where it prevents disputes
- [ ] Deploy in r40 common frontend update
- [ ] Real-device validation

---

# SPRINT 7 · HOME DASHBOARD
Status: IN PROGRESS

Home answers: "What do I need to know or do now?"

- [x] Current shift status
- [x] Important unresolved handover
- [x] Personal last-attestation state
- [x] Personal Knowledge completed count
- [x] Global Recipes + Knowledge search
- [x] Remove decorative roadmap/pause widgets from Home
- [x] dashboard.js / CSS prepared
- [ ] Add new recipe/SOP notification only after content-change feed exists
- [ ] Deploy in r40 common frontend update
- [ ] Real-device validation

---

# SPRINT 8 · HARDENING
Status: PLANNED

## Supabase
- [x] recovery_attempts explicit deny-all browser policy
- [~] Leaked-password warning reviewed; custom staff credential flow still needs final Auth-setting decision
- [x] Useful FK indexes added
- [x] Duplicate indexes removed
- [x] Auth/RLS initialization-plan warnings fixed
- [x] Browser profile access reduced to safe directory columns
- [x] Direct authenticated profile UPDATE removed
- [x] Advisors re-run after hardening
- [x] SECURITY DEFINER warnings documented as intentional constrained RPC endpoints

## Audit
- [ ] audit_log
- [ ] role changes
- [ ] activation/deactivation
- [ ] important resets
- [ ] critical operational changes

## PWA
- [x] Basic offline shell
- [x] Recipes offline
- [x] Knowledge offline
- [x] Global offline connectivity indicator prepared
- [x] Operational modules refuse fake local success states
- [x] Slow-navigation/static-fetch timeout pass
- [x] Query-string offline cache fallback for Knowledge assets
- [x] Service Worker release-update notice prepared
- [x] Cache invalidation/version review
- [x] Accessibility/focus/reduced-motion pass
- [ ] Real-device regression after r40 deploy

---

# SPRINT 9 · PILOT
Status: PLANNED

7-14 days.

Measure later:
- independent repeat usage;
- attestation comprehension;
- handover adoption;
- failure/confusion points.

Timed recipe/knowledge lookup is optional unless product owner reinstates it.

---

# FROZEN BACKLOG
- [F] Generic internal chat
- [F] Games
- [F] Mini-app entertainment
- [F] Gamification
- [F] Rankings
- [F] Achievements
- [F] Payroll
- [F] Scheduling
- [F] Inventory
- [F] Purchasing
- [F] Full food costing
- [F] Embedded AI assistant
- [F] Complex analytics

---

# MANUAL BLOCKERS / ACCESS
- [!] GitHub integration currently reads repository but write attempts may return 403
- [ ] Manual upload remains fallback for code packages
- [ ] No direct Cloudflare connector in this workspace

---

# TEAM LEAD RULE
Before new feature work:
1. Check TASKS.
2. Finish or explicitly defer current Active work.
3. Update project docs when architecture changes.
4. Promote only the next justified item.
5. Review major UI choices for contemporary product relevance and native-app scalability.


---

# RELEASE r40 · CANDIDATE
Status: READY AFTER NOCODB / CLOUDFLARE MANUAL STEP

- [x] r24.2 Pilot UI retained
- [x] Recipe Archive/search semantics
- [x] Admin-only recipe governance frontend prepared
- [x] Supabase audit trail
- [x] Admin Employees / Attestations / Audit console
- [x] Permanent staff deletion
- [x] Attestation Supabase persistence
- [x] Knowledge progress Supabase persistence
- [x] Structured Shift Handover
- [x] Opening/closing shared workflow
- [x] Contextual Home dashboard
- [x] Backend/RLS/index hardening
- [x] PWA/runtime hardening
- [x] Accessibility pass
- [ ] Create NocoDB governance fields
- [ ] Add Cloudflare NOCODB_WRITE_TOKEN
- [ ] Live-test NocoDB PATCH
- [ ] Deploy governance Worker
- [ ] Deploy r40 frontend package
- [ ] iPhone regression
- [ ] Android regression
