BeerFactory Staff Portal · r40 RELEASE CANDIDATE

This archive supersedes r25-r36 pending frontend packages.

DO NOT deploy piecemeal.

Backend migrations already applied safely:
- audit log
- admin audit for staff changes
- permanent staff deletion
- attestation persistence schema
- Knowledge progress schema
- structured handover schema/RPC
- shift workflow schema/RPC
- r37 RLS/index hardening

Manual blocker before full Recipe Governance enablement:
1. create 5 NocoDB governance fields;
2. configure separate Cloudflare NOCODB_WRITE_TOKEN;
3. deploy worker-admin-governance.js;
4. live-test one admin PATCH.

Frontend recipe admin controls are capability-gated, so r40 does not expose dead edit controls when the governance Worker is not yet active.

Read:
- DEPLOY_R40.md
- RELEASE_NOTES_R40.md
- PROJECT_SPEC.md
- TASKS.md
