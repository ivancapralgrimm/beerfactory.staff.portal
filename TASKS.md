# BeerFactory Staff Portal · TASKS

Status legend:
- [x] Done
- [ ] Active / planned
- [~] In progress
- [!] Blocker / manual action
- [F] Frozen

---

## CURRENT BASELINE AFTER r22 DEPLOYMENT

- [x] GitHub main is canonical after each deployment
- [x] app.js r11
- [x] app.css r10
- [x] learning.js / learning.css r23 after deployment
- [x] mobile compatibility layer exists
- [x] Service Worker offline shell exists
- [x] Cloudflare Worker reads NocoDB
- [x] Supabase project healthy
- [x] Auth / recovery / profile / admin Edge Functions active
- [x] 4 staff profiles currently exist

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
Status: NEXT

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
- [ ] Worker safely exposes governance fields
- [ ] Staff sees only Current
- [ ] Display updated date
- [ ] Display short change note
- [ ] Define archive behavior

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

Definition of Done:
- Staff can reach a needed instruction without conflicting duplicate versions.
- Articles remain usable offline after cache population.

---

# SPRINT 4 · ATTESTATION
Status: PLANNED

## Content
- [x] Large question bank exists
- [x] Service materials exist
- [ ] Finalize categories and remove ambiguous questions
- [ ] No unnecessary gram/ml memorization

## Backend
- [ ] Persist attempts in Supabase
- [ ] Store category / start / finish / total / correct / score / passed
- [ ] Decide per-answer history
- [ ] Weak-topic data

## UX
- [ ] Random subset
- [ ] Shuffle answers
- [ ] Pass threshold
- [ ] Retry policy
- [ ] Manager visibility
- [ ] Useful failure feedback

---

# SPRINT 5 · SHIFT HANDOVER
Status: PLANNED

Do NOT build a Telegram clone.

- [ ] Category
- [ ] Priority
- [ ] Author
- [ ] Created at
- [ ] Body
- [ ] Status
- [ ] Acknowledged by/at
- [ ] Resolved by/at
- [ ] Important unresolved first
- [ ] One-tap acknowledge
- [ ] One-tap resolve
- [ ] Filter category
- [ ] Link recipe/SOP where useful

---

# SPRINT 6 · OPENING / CLOSING
Status: PLANNED

- [ ] Bar opening
- [ ] Bar closing
- [ ] Decide Hall/Kitchen separation
- [ ] Checkbox
- [ ] Numeric/temperature where justified
- [ ] Photo only for critical cases
- [ ] completed_by / completed_at
- [ ] Critical incomplete state cannot look green

---

# SPRINT 7 · HOME DASHBOARD
Status: PLANNED

Home answers: "What do I need to know or do now?"

- [ ] Shift status
- [ ] Important handover
- [ ] New recipe/SOP
- [ ] Pending attestation
- [ ] Global search
- [ ] Remove decorative non-work widgets

---

# SPRINT 8 · HARDENING
Status: PLANNED

## Supabase
- [ ] Document recovery_attempts service-role-only behavior
- [ ] Review leaked-password warning relevance
- [ ] Add useful FK indexes
- [ ] Optimize auth RLS calls
- [ ] Re-run advisors

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
- [ ] Error-state pass
- [ ] Slow-network pass
- [ ] Cache invalidation review
- [ ] Accessibility pass

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
