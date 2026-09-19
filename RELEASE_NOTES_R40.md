# BeerFactory Staff Portal · r40 Release Candidate

r40 is the first consolidated release after the pilot UI pause.

## User-facing
- BeerFactory design-system login/profile UI retained.
- Recipes: list/detail, calculator, offline cache, Archive pseudo-category, archive search.
- Knowledge: list/detail, offline content, Supabase read progress.
- Attestation: Supabase attempt history and weak-topic data.
- Shift Handover: structured category/priority/status, acknowledge/resolve.
- Shift: shared opening/closing checklist with server-confirmed state.
- Home: contextual shift/handover/learning/attestation dashboard + global search.
- Global offline indicator.
- Accessibility/focus/reduced-motion pass.

## Admin
- Employees.
- Attestations.
- Audit history.
- Permanent tester/staff deletion with explicit typed confirmation.
- Recipe governance UI is capability-gated and admin-only.

## Backend already applied
- audit_log.
- quiz_attempts v2 fields/indexes.
- training_progress uniqueness/index.
- structured handover schema/RPC.
- shift workflow definitions/RPC.
- admin user deletion.
- RLS/FK/index hardening.

## Still manual before release
One live admin PATCH verification + frontend/mobile regression. NocoDB governance fields, separate read/write tokens and the source-aware Cloudflare Worker are already configured.


## Recipe routing fix
BAR and KITCHEN NocoDB record IDs are table-local and can overlap.
Portal/deep-link IDs are now namespaced by source while the true NocoDB record ID
is retained separately as `recordId`. Admin governance writes use the pair `source + recordId`, never a raw table-local ID alone. The frontend requires `capabilities.source_aware_ids = true` before enabling Save.
