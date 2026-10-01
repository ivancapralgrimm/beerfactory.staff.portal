# Backend contract check — r40.5 final pass

Authority: supplied `BFStaff_r40.5_SUPABASE_FOUNDATION_LIVE_SYNC.zip`, SHA-256
`edadaa26617e4564413710c6f07601b78baaf7104ce051ed7cf25f9299a33573`.
Its README, contract, server state, manifest, checksums, both SQL files, generator
and complete Edge source were read. No live query or mutation was performed.
The provided live-state assertions are attributed to the package, not independently
verified here. Preserved evidence is in `docs/r40.5-live-sync/`; its manifest/checksums
refer to paths in the original upload, while canonical SQL/Edge/tools are at repository root.

| Contract | Initial implementation | Final implementation / evidence |
| --- | --- | --- |
| Editor context | Single can_edit and Owner/Admin client candidate | Five required booleans; server context fetched for authenticated active profiles; distinct create/edit/publish controls; default Staff/Senior still denied |
| Published first_image | String path assumed | Object `{mediaId,storagePath,legacySrc,alt}` or null; all 26 seed summaries decode, 8 summaries contain the 12 image blocks |
| Editor index | Requested as missing RPC | Existing get_knowledge_editor_articles used; obsolete request superseded |
| Documents | Schema v2 | Same schema; metadata/order preserved; seeded descriptions treated as list excerpts, not duplicated body text |
| Blocks | Allowed zero blocks locally | Require 1..200; sole block cannot be deleted |
| save | expected revision | p_document + p_expected_revision unchanged; conflict preserves draft, no retry with a newer revision |
| Upload | Sent unused article_id; required signed URL | Multipart file only; accept successful metadata with empty URL; pending media binds during save |
| Storage | Private knowledge-media | Same private bucket, SDK signed URLs; 3600s client TTL, refresh on resume/online/50min; supplied Edge uses 900s |
| Legacy images | Converter supplied caption=alt | Server payload has empty caption/name; presentation-only legacy caption fallback to alt |
| Reader activation | Explicit server env only | Local r40.5-preview mode or Vercel preview branch r40.5; production build guarded to legacy; explicit legacy preview override |
| CRUD/security | RPC/Edge architecture | No browser Knowledge table CRUD; existing auth hotfix and role/position code byte-identical |


## Post-Codex backend-owner verification — 2026-09-30

ChatGPT independently queried the connected live Supabase project after the Codex return. The three supplied Knowledge migrations were present, then additive migration `20260930214301_r40_5_knowledge_integrity_hardening` was applied and verified. `knowledge-media-upload` was upgraded to v2 ACTIVE with `verify_jwt=true`.

Current reviewed source hashes:

- `20260930214301_r40_5_knowledge_integrity_hardening.sql`: `25d814a15343657dd0145bff4bace91887cae85d7871c3820fbb36f451f930ea`.
- `knowledge-media-upload/index.ts` v2 source: `054d94aaeea93e79212d65050d85f942a0db93dc5576ee85d4fbb570a3256c25`.
- Deployed v2 ezbr artifact SHA reported by Supabase: `6994d392c86177beb3b34fbb1ecef381f53a76bef10aa8c26f054234025de2c8`.

BR-01/02/03 are resolved; BR-04 is materially hardened with pinned Supabase client and bounded container validation. See `R40_5_CODEX_BACKEND_REQUESTS.md`. Remaining work is live account/device QA rather than another schema redesign.

## Reproduced already-applied migration history

- `20260930151257_r40_5_knowledge_content_foundation.sql`: exact supplied bytes,
  SHA `0ee91cc3d4bb3494304d66136097e113c60f90c9a485d6926f50bdca5e0d18b7`.
- `20260930151818_r40_5_knowledge_security_hardening.sql`: exact supplied bytes,
  SHA `8626fcec365e342206788dd09d628e0b49a508dbe94243f6798ea24dbc9846b2`.
- `20260930152047_r40_5_knowledge_legacy_seed_v1.sql`: generated using the exact
  supplied tool and untouched assets/training-data.txt, as instructed in README.
  Two local generations matched; test reproduces it in memory. SHA
  `a0227b46597d5e543d3a562826b938b3ea1367756ae1b4508ec373225725d40c`.
  The archive did not contain a third SQL file or independent live seed-file checksum;
  this is deterministic reproduction, not a checksum measured from the live database.
- Historical Live Sync Edge v1 source SHA was `1ef3dbadcb8fa6d8eb580d2ca777d79a7543782a67d854f4914a8ad4ed965017`.
- Current reviewed/deployed Edge v2 source SHA is `054d94aaeea93e79212d65050d85f942a0db93dc5576ee85d4fbb570a3256c25`; Supabase reports v2 ACTIVE with ezbr SHA `6994d392c86177beb3b34fbb1ecef381f53a76bef10aa8c26f054234025de2c8`.

Do not rerun these on the same live database; do not run supabase db push.

## Server authorization review

Offline source inspection finds SECURITY DEFINER RPCs with empty search_path,
Auth/active-profile checks and separate create/edit/publish predicates. Owner/Admin
are privileged independently of working position. Future grants are server owned;
frontend adds no grant administration or default Senior/Staff editing access.
Direct table privileges are revoked and hardening adds restrictive deny policies.
Storage checks active profile and article/media visibility; service-role stays in Edge.
These source findings and mocked 403s do not prove effective deployed RLS/grants.

The Codex backend findings are tracked in `R40_5_CODEX_BACKEND_REQUESTS.md`. BR-01/02/03 are now resolved by the backend owner; BR-04 has been hardened without changing the frontend API or adding a heavyweight decoder. Existing-row optimistic locking still matches the client. No alternative tables, grants or incompatible RPCs were introduced.

Decision: frontend aligned for preview and ready for architecture/security review;
production cutover and live authorization/parity tests remain gated by NEEDS_LIVE_QA.md.
